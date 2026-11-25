import { Node } from "prosemirror-model";
import { EditorState, Plugin, PluginKey, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import type { Dictionary } from "~/hooks/useDictionary";
import { isCode } from "../lib/isCode";
import { findParentNode } from "../queries/findParentNode";

/** Code blocks with more lines than this are collapsed until expanded. */
export const COLLAPSE_MIN_LINES = 25;

type CodeCollapseState = {
  /** Positions of long code blocks the user has expanded. */
  expanded: number[];
  /** Position of the code block shown full screen, if any. */
  fullscreen: number | null;
  decorations: DecorationSet;
};

type CodeCollapseMeta = { toggle: number } | { fullscreen: number | null };

const pluginKeys: Record<string, PluginKey<CodeCollapseState>> = {};

/**
 * Returns the plugin key for the given code node type, code_fence and
 * code_block each get their own plugin instance.
 */
function codeCollapseKey(name: string) {
  pluginKeys[name] ??= new PluginKey<CodeCollapseState>(
    `code-collapse-${name}`
  );
  return pluginKeys[name];
}

/**
 * Returns a command that toggles full screen view of the code block at the
 * selection.
 */
export function toggleCodeFullscreen(
  state: EditorState,
  dispatch?: (tr: Transaction) => void
) {
  const codeBlock = findParentNode(isCode)(state.selection);
  if (!codeBlock) {
    return false;
  }
  const key = codeCollapseKey(codeBlock.node.type.name);
  const current = key.getState(state)?.fullscreen;
  dispatch?.(
    state.tr.setMeta(key, {
      fullscreen: current === codeBlock.pos ? null : codeBlock.pos,
    })
  );
  return true;
}

function lineCount(node: Node) {
  return node.textContent.split("\n").length;
}

function buildDecorations(
  doc: Node,
  name: string,
  expanded: number[],
  fullscreen: number | null,
  dictionary: Dictionary
) {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== name) {
      return !node.isTextblock;
    }
    if (node.attrs.language === "mermaidjs") {
      return false;
    }

    const lines = lineCount(node);
    const long = lines > COLLAPSE_MIN_LINES;
    const isFullscreen = fullscreen === pos;
    if (!long && !isFullscreen) {
      return false;
    }

    const collapsed = long && !isFullscreen && !expanded.includes(pos);
    const classes = [
      collapsed ? "code-collapsed" : "",
      isFullscreen ? "code-fullscreen" : "",
    ].join(" ");
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, { class: classes })
    );

    const end = pos + node.nodeSize;
    decorations.push(
      Decoration.widget(
        end,
        (view: EditorView, getPos: () => number | undefined) =>
          renderBar(view, getPos, {
            lines,
            long,
            collapsed,
            isFullscreen,
            dictionary,
            key: codeCollapseKey(name),
          }),
        {
          side: -1,
          ignoreSelection: true,
          stopEvent: () => true,
          key: `code-bar-${lines}-${long}-${collapsed}-${isFullscreen}`,
        }
      )
    );
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

function renderBar(
  view: EditorView,
  getPos: () => number | undefined,
  options: {
    lines: number;
    long: boolean;
    collapsed: boolean;
    isFullscreen: boolean;
    dictionary: Dictionary;
    key: PluginKey<CodeCollapseState>;
  }
) {
  const { lines, long, collapsed, isFullscreen, dictionary, key } = options;
  const bar = document.createElement("div");
  bar.className = [
    "code-block-bar",
    collapsed ? "collapsed" : "",
    isFullscreen ? "fullscreen" : "",
  ].join(" ");
  bar.contentEditable = "false";

  const blockPos = () => {
    const pos = getPos();
    if (pos === undefined) {
      return undefined;
    }
    const node = view.state.doc.resolve(pos).nodeBefore;
    return node ? pos - node.nodeSize : undefined;
  };

  const addButton = (
    label: string,
    meta: (pos: number) => CodeCollapseMeta
  ) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const pos = blockPos();
      if (pos !== undefined) {
        view.dispatch(view.state.tr.setMeta(key, meta(pos)));
      }
    });
    bar.appendChild(button);
  };

  if (long && !isFullscreen) {
    addButton(
      collapsed
        ? `${dictionary.expandCode} (${lines})`
        : dictionary.collapseCode,
      (pos) => ({ toggle: pos })
    );
  }
  addButton(
    isFullscreen ? dictionary.exitFullscreen : dictionary.fullscreen,
    (pos) => ({ fullscreen: isFullscreen ? null : pos })
  );

  return bar;
}

/**
 * Collapses long code blocks behind an "expand" bar and allows showing any
 * code block full screen.
 */
export default function CodeCollapse({
  name,
  dictionary,
}: {
  /** The node name. */
  name: string;
  dictionary: Dictionary;
}) {
  const key = codeCollapseKey(name);
  const isOwnCode = (node: Node) => node.type.name === name;

  return new Plugin<CodeCollapseState>({
    key,
    state: {
      init: (_, { doc }) => ({
        expanded: [],
        fullscreen: null,
        decorations: buildDecorations(doc, name, [], null, dictionary),
      }),
      apply: (tr, value, oldState, newState) => {
        const meta = tr.getMeta(key) as CodeCollapseMeta | undefined;
        let expanded = value.expanded
          .map((pos) => tr.mapping.mapResult(pos))
          .filter((result) => !result.deleted)
          .map((result) => result.pos);
        let fullscreen =
          value.fullscreen === null
            ? null
            : tr.mapping.mapResult(value.fullscreen).deleted
            ? null
            : tr.mapping.map(value.fullscreen);

        // Moving the cursor into a collapsed block expands it so the text being
        // edited stays visible.
        const block = findParentNode(isOwnCode)(newState.selection);
        if (block && !expanded.includes(block.pos)) {
          const previous = findParentNode(isOwnCode)(oldState.selection);
          if (!previous || tr.mapping.map(previous.pos) !== block.pos) {
            expanded = [...expanded, block.pos];
          }
        }

        if (meta && "toggle" in meta) {
          expanded = expanded.includes(meta.toggle)
            ? expanded.filter((pos) => pos !== meta.toggle)
            : [...expanded, meta.toggle];
        }
        if (meta && "fullscreen" in meta) {
          fullscreen = meta.fullscreen;
        }

        const changed =
          tr.docChanged ||
          fullscreen !== value.fullscreen ||
          expanded.length !== value.expanded.length ||
          expanded.some((pos, i) => pos !== value.expanded[i]);

        return {
          expanded,
          fullscreen,
          decorations: changed
            ? buildDecorations(tr.doc, name, expanded, fullscreen, dictionary)
            : value.decorations,
        };
      },
    },
    view: (view) => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === "Escape" &&
          key.getState(view.state)?.fullscreen !== null
        ) {
          event.preventDefault();
          event.stopPropagation();
          view.dispatch(view.state.tr.setMeta(key, { fullscreen: null }));
        }
      };
      const setScrollLock = (lock: boolean) => {
        document.body.style.overflow = lock ? "hidden" : "";
      };
      let locked = false;
      document.addEventListener("keydown", onKeyDown, true);

      return {
        update: () => {
          const next = key.getState(view.state)?.fullscreen !== null;
          if (next !== locked) {
            locked = next;
            setScrollLock(locked);
          }
        },
        destroy: () => {
          document.removeEventListener("keydown", onKeyDown, true);
          if (locked) {
            setScrollLock(false);
          }
        },
      };
    },
    props: {
      decorations(state) {
        return key.getState(state)?.decorations;
      },
    },
  });
}
