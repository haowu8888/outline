import { Token } from "markdown-it";
import { NodeSpec, NodeType, Node as ProsemirrorNode } from "prosemirror-model";
import { Command, NodeSelection } from "prosemirror-state";
import * as React from "react";
import ExcalidrawBoard from "../components/ExcalidrawBoard";
import { svgToDataUrl } from "../lib/excalidraw";
import { MarkdownSerializerState } from "../lib/markdown/serializer";
import excalidrawRule, { EXCALIDRAW_FENCE } from "../rules/excalidraw";
import { ComponentProps } from "../types";
import Node from "./Node";

/**
 * A hand drawn whiteboard powered by Excalidraw. The scene is stored as JSON
 * together with a rendered SVG preview so documents can be read without
 * loading the drawing editor.
 */
export default class Excalidraw extends Node {
  get name() {
    return "excalidraw";
  }

  get schema(): NodeSpec {
    return {
      group: "block",
      atom: true,
      selectable: true,
      draggable: true,
      attrs: {
        data: {
          default: "",
        },
        svg: {
          default: "",
        },
      },
      parseDOM: [
        {
          tag: "div.excalidraw-board",
          getAttrs: (dom: HTMLDivElement) => ({
            data: dom.getAttribute("data-excalidraw") ?? "",
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "excalidraw-board",
          "data-excalidraw": node.attrs.data,
        },
        ...(node.attrs.svg
          ? [["img", { src: svgToDataUrl(node.attrs.svg), alt: "Drawing" }]]
          : []),
      ],
      toPlainText: () => "",
    };
  }

  get rulePlugins() {
    return [excalidrawRule];
  }

  handleSave =
    ({ getPos }: { getPos: () => number }) =>
    (data: string, svg: string) => {
      const { view } = this.editor;
      const pos = getPos();
      const node = view.state.doc.nodeAt(pos);
      if (!node || node.type.name !== this.name) {
        return;
      }
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { data, svg }));
    };

  component = (props: ComponentProps) => (
    <ExcalidrawBoard {...props} onSave={this.handleSave(props)} />
  );

  commands({ type }: { type: NodeType }) {
    return (): Command => (state, dispatch) => {
      if (dispatch) {
        const node = type.create();
        const tr = state.tr.replaceSelectionWith(node);
        let inserted = -1;
        tr.doc.descendants((child, pos) => {
          if (child === node) {
            inserted = pos;
          }
          return inserted === -1;
        });
        if (inserted >= 0) {
          // Selecting the new drawing opens the editor straight away.
          tr.setSelection(NodeSelection.create(tr.doc, inserted));
        }
        dispatch(tr.scrollIntoView());
      }
      return true;
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write("```" + EXCALIDRAW_FENCE + "\n");
    state.text(node.attrs.data || "{}", false);
    state.ensureNewLine();
    state.write("```");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "excalidraw",
      noCloseToken: true,
      getAttrs: (token: Token) => ({
        data: token.content.trim(),
      }),
    };
  }
}
