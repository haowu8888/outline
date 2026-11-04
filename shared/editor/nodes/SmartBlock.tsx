import { Token } from "markdown-it";
import { NodeSpec, NodeType, Node as ProsemirrorNode } from "prosemirror-model";
import { Command, NodeSelection } from "prosemirror-state";
import * as React from "react";
import { Primitive } from "utility-types";
import SmartBlockView from "../components/SmartBlocks";
import { MarkdownSerializerState } from "../lib/markdown/serializer";
import {
  MAX_SMART_BLOCK_SIZE,
  SmartBlockKind,
  blockId,
  blockPlainText,
  defaultBlockData,
  isSmartBlockKind,
} from "../lib/smartBlocks";
import smartBlocksRule from "../rules/smartBlocks";
import { ComponentProps } from "../types";
import Node from "./Node";

/**
 * Interactive blocks such as kanban boards, galleries, calendars, polls,
 * check-ins and encrypted text. The block data is stored as JSON in the node.
 */
export default class SmartBlock extends Node {
  get name() {
    return "smart_block";
  }

  get schema(): NodeSpec {
    return {
      group: "block",
      atom: true,
      selectable: true,
      draggable: true,
      attrs: {
        kind: {
          default: "kanban",
        },
        data: {
          default: "",
        },
      },
      parseDOM: [
        {
          tag: "div.smart-block",
          getAttrs: (dom: HTMLDivElement) => {
            const kind = dom.getAttribute("data-kind");
            return isSmartBlockKind(kind)
              ? { kind, data: dom.getAttribute("data-block") ?? "" }
              : false;
          },
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "smart-block",
          "data-kind": node.attrs.kind,
          "data-block": node.attrs.data,
        },
        blockPlainText(node.attrs.kind, node.attrs.data),
      ],
      toPlainText: (node) => blockPlainText(node.attrs.kind, node.attrs.data),
    };
  }

  get rulePlugins() {
    return [smartBlocksRule];
  }

  handleSave =
    ({ getPos }: { getPos: () => number }) =>
    (update: (current: string) => unknown) => {
      const { view } = this.editor;
      const pos = getPos();
      const node = view.state.doc.nodeAt(pos);
      if (!node || node.type.name !== this.name) {
        return;
      }
      // Apply the change to the latest data, other fields or collaborators
      // may have changed the block since it was rendered.
      const json = JSON.stringify(update(node.attrs.data));
      if (json.length > MAX_SMART_BLOCK_SIZE) {
        throw new Error("Block is too large");
      }
      view.dispatch(
        view.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          data: json,
        })
      );
    };

  component = (props: ComponentProps) => (
    <SmartBlockView
      {...props}
      userId={this.editor.props.userId}
      uploadFile={this.editor.props.uploadFile}
      onSave={this.handleSave(props)}
    />
  );

  /** Initial data of a new block, with localized default titles. */
  private initialData(kind: SmartBlockKind) {
    const { dictionary } = this.options;
    if (kind === "kanban" && dictionary) {
      return {
        ...defaultBlockData("kanban"),
        columns: [
          dictionary.kanbanTodo,
          dictionary.kanbanDoing,
          dictionary.kanbanDone,
        ].map((title: string) => ({ id: blockId(), title })),
      };
    }
    return defaultBlockData(kind);
  }

  commands({ type }: { type: NodeType }) {
    return (attrs?: Record<string, Primitive>): Command =>
      (state, dispatch) => {
        const kind = attrs?.kind;
        if (!isSmartBlockKind(kind)) {
          return false;
        }
        if (dispatch) {
          const node = type.create({
            kind,
            data: JSON.stringify(this.initialData(kind)),
          });
          const tr = state.tr.replaceSelectionWith(node);
          let inserted = -1;
          tr.doc.descendants((child, pos) => {
            if (child === node) {
              inserted = pos;
            }
            return inserted === -1;
          });
          if (inserted >= 0) {
            tr.setSelection(NodeSelection.create(tr.doc, inserted));
          }
          dispatch(tr.scrollIntoView());
        }
        return true;
      };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write("```" + node.attrs.kind + "\n");
    // Escape backticks so that text in the JSON can not close the fence.
    state.text((node.attrs.data || "{}").replace(/`/g, "\\u0060"), false);
    state.ensureNewLine();
    state.write("```");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "smart_block",
      noCloseToken: true,
      getAttrs: (token: Token) => ({
        kind: token.info.trim(),
        data: token.content.trim(),
      }),
    };
  }
}
