import {
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
  ResolvedPos,
} from "prosemirror-model";
import { Command, EditorState, Plugin, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Primitive } from "utility-types";
import { MarkdownSerializerState } from "../lib/markdown/serializer";
import columnsRule, { COLUMNS_MARKER_LENGTH } from "../rules/columns";
import Node from "./Node";

export const MIN_COLUMNS = 2;

export const MAX_COLUMNS = 4;

type ColumnContext = {
  /** Position before the layout node. */
  layoutPos: number;
  layout: ProsemirrorNode;
  /** Position before the column that contains the selection. */
  columnPos: number;
  column: ProsemirrorNode;
};

/** Find the column layout that contains the given position, if any. */
export function findColumns($pos: ResolvedPos): ColumnContext | undefined {
  for (let depth = $pos.depth; depth > 1; depth--) {
    if ($pos.node(depth).type.name === "column") {
      return {
        layoutPos: $pos.before(depth - 1),
        layout: $pos.node(depth - 1),
        columnPos: $pos.before(depth),
        column: $pos.node(depth),
      };
    }
  }
  return undefined;
}

/** How many column layouts are nested inside the given node. */
function nestingDepth(node: ProsemirrorNode): number {
  let depth = 0;
  node.descendants((child) => {
    if (child.type.name === "columns") {
      depth = Math.max(depth, nestingDepth(child) + 1);
      return false;
    }
    return true;
  });
  return depth;
}

/**
 * Markdown marker for a layout, an outer layout needs a longer marker than any
 * layout nested inside it, otherwise the inner closing marker would end it.
 */
export function columnsMarker(node: ProsemirrorNode) {
  return ":".repeat(COLUMNS_MARKER_LENGTH + nestingDepth(node) * 2);
}

/** Add a column after the one containing the selection. */
export const addColumn: Command = (state, dispatch) => {
  const context = findColumns(state.selection.$from);
  if (!context || context.layout.childCount >= MAX_COLUMNS) {
    return false;
  }
  if (dispatch) {
    const { schema } = state;
    const insertAt = context.columnPos + context.column.nodeSize;
    const tr = state.tr.insert(
      insertAt,
      schema.nodes.column.create(null, schema.nodes.paragraph.create())
    );
    tr.setSelection(TextSelection.create(tr.doc, insertAt + 2));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Remove the column containing the selection. */
export const removeColumn: Command = (state, dispatch) => {
  const context = findColumns(state.selection.$from);
  if (!context || context.layout.childCount <= MIN_COLUMNS) {
    return false;
  }
  if (dispatch) {
    const tr = state.tr.delete(
      context.columnPos,
      context.columnPos + context.column.nodeSize
    );
    const $pos = tr.doc.resolve(
      Math.min(context.columnPos, tr.doc.content.size)
    );
    tr.setSelection(TextSelection.near($pos));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Replace the layout with the content of all of its columns. */
export const unwrapColumns: Command = (state, dispatch) => {
  const context = findColumns(state.selection.$from);
  if (!context) {
    return false;
  }
  if (dispatch) {
    const blocks: ProsemirrorNode[] = [];
    context.layout.forEach((column) =>
      column.forEach((block) => {
        blocks.push(block);
      })
    );
    const tr = state.tr.replaceWith(
      context.layoutPos,
      context.layoutPos + context.layout.nodeSize,
      blocks
    );
    tr.setSelection(TextSelection.near(tr.doc.resolve(context.layoutPos + 1)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * A side by side layout, each column holds regular document content.
 */
export default class Columns extends Node {
  get name() {
    return "columns";
  }

  get markdownToken() {
    return "container_columns";
  }

  get schema(): NodeSpec {
    return {
      group: "block",
      content: `column{${MIN_COLUMNS},${MAX_COLUMNS}}`,
      isolating: true,
      parseDOM: [{ tag: "div.columns" }],
      toDOM: () => ["div", { class: "columns" }, 0],
    };
  }

  get rulePlugins() {
    return [columnsRule];
  }

  get plugins() {
    const { dictionary } = this.options;
    const actions: [string, Command][] = [
      [dictionary?.addColumn ?? "Add column", addColumn],
      [dictionary?.removeColumn ?? "Remove column", removeColumn],
      [dictionary?.unwrapColumns ?? "Remove columns", unwrapColumns],
    ];

    const toolbar = (view: EditorView) => {
      const dom = document.createElement("div");
      dom.className = "columns-toolbar";
      dom.contentEditable = "false";
      if (!view.editable) {
        return dom;
      }
      for (const [label, command] of actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.disabled = !command(view.state);
        // Keep the selection inside the column while clicking.
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => {
          command(view.state, view.dispatch);
          view.focus();
        });
        dom.appendChild(button);
      }
      return dom;
    };

    return [
      new Plugin({
        props: {
          decorations: (state: EditorState) => {
            const context = findColumns(state.selection.$from);
            if (!context) {
              return null;
            }
            return DecorationSet.create(state.doc, [
              Decoration.node(
                context.layoutPos,
                context.layoutPos + context.layout.nodeSize,
                { class: "columns-active" }
              ),
              Decoration.widget(context.layoutPos, toolbar, {
                side: -1,
                ignoreSelection: true,
                key: `columns-toolbar-${context.layout.childCount}`,
              }),
            ]);
          },
        },
      }),
    ];
  }

  commands({ type }: { type: NodeType }) {
    return (attrs?: Record<string, Primitive>): Command =>
      (state, dispatch) => {
        // Layouts inside layouts get too narrow to be useful.
        if (findColumns(state.selection.$from)) {
          return false;
        }
        const count = Math.min(
          MAX_COLUMNS,
          Math.max(MIN_COLUMNS, Number(attrs?.count) || MIN_COLUMNS)
        );
        const { schema } = state;
        const columns = Array.from({ length: count }, () =>
          schema.nodes.column.create(null, schema.nodes.paragraph.create())
        );
        if (dispatch) {
          const node = type.create(null, columns);
          const tr = state.tr.replaceSelectionWith(node);
          let inserted = -1;
          tr.doc.descendants((child, pos) => {
            if (child === node) {
              inserted = pos;
            }
            return inserted === -1;
          });
          if (inserted >= 0) {
            // Place the cursor in the first paragraph of the first column.
            tr.setSelection(TextSelection.create(tr.doc, inserted + 3));
          }
          dispatch(tr.scrollIntoView());
        }
        return true;
      };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    const marker = columnsMarker(node);
    state.write("\n" + marker + "columns\n");
    node.forEach((column) => {
      state.write(marker.slice(1) + "column\n");
      state.renderContent(column);
      state.ensureNewLine();
      state.write(marker.slice(1));
      state.closeBlock(column);
    });
    state.ensureNewLine();
    state.write(marker);
    state.closeBlock(node);
  }

  parseMarkdown() {
    return { block: "columns" };
  }
}

/**
 * A single column inside a column layout.
 */
export class Column extends Node {
  get name() {
    return "column";
  }

  get markdownToken() {
    return "container_column";
  }

  get schema(): NodeSpec {
    return {
      content: "block+",
      isolating: true,
      defining: true,
      parseDOM: [{ tag: "div.column" }],
      toDOM: () => ["div", { class: "column" }, 0],
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.renderContent(node);
  }

  parseMarkdown() {
    return { block: "column" };
  }
}
