import { action, observable } from "mobx";
import { Slice } from "prosemirror-model";
import { Command, EditorState } from "prosemirror-state";
import * as React from "react";
import Extension, { WidgetProps } from "@shared/editor/lib/Extension";
import normalizePastedMarkdown from "@shared/editor/lib/markdown/normalize";
import AIConfig from "~/utils/AIConfig";
import AIWritingPanel from "../components/AIWritingPanel";

export type AIWritingAction =
  | "continue"
  | "polish"
  | "expand"
  | "shorten"
  | "summarize"
  | "translate_en"
  | "translate_zh"
  | "fix"
  | "custom";

export type AIWritingStatus = "idle" | "streaming" | "done" | "error";

/** Maximum characters of preceding text sent as context to continue writing. */
const CONTEXT_LENGTH = 4000;

/**
 * Editor extension that sends the selection (or the text before the cursor)
 * to the AI writing API and lets the user insert or replace with the result.
 */
export default class AIWritingExtension extends Extension {
  get name() {
    return "ai-writing";
  }

  get focusAfterExecution() {
    return false;
  }

  commands() {
    return {
      /**
       * Open the AI writing panel for the given action.
       *
       * @param attrs.action The writing action to perform.
       */
      aiWrite:
        (attrs: { action: AIWritingAction }): Command =>
        (state) => {
          if (!AIConfig.enabled) {
            return false;
          }
          this.start(attrs.action, state);
          return true;
        },
    };
  }

  widget = ({ readOnly }: WidgetProps) => {
    if (!readOnly) {
      // Only editors need to know whether AI writing is available.
      void AIConfig.load();
    }
    return this.renderPanel(readOnly);
  };

  private renderPanel = (readOnly: boolean | undefined) => (
    <AIWritingPanel
      open={this.open && !readOnly}
      action={this.action}
      status={this.status}
      output={this.output}
      error={this.error}
      canReplace={this.from !== this.to}
      onRun={this.run}
      onReplace={() => this.insert(true)}
      onInsert={() => this.insert(false)}
      onClose={this.close}
    />
  );

  @observable
  private open = false;

  @observable
  private action: AIWritingAction = "polish";

  @observable
  private status: AIWritingStatus = "idle";

  @observable
  private output = "";

  @observable
  private error = "";

  @observable
  private from = 0;

  @observable
  private to = 0;

  private source = "";

  private controller?: AbortController;

  @action
  private start(writingAction: AIWritingAction, state: EditorState) {
    const { from, to, empty } = state.selection;
    const serializer = this.editor.extensions.serializer();

    this.controller?.abort();
    this.action = writingAction;
    this.output = "";
    this.error = "";
    this.status = "idle";
    this.open = true;

    if (writingAction === "continue" || empty) {
      // Continue after the selection using the preceding text as context.
      this.from = this.to = to;
      this.source = state.doc
        .textBetween(Math.max(0, to - CONTEXT_LENGTH), to, "\n\n")
        .trim();
    } else {
      this.from = from;
      this.to = to;
      this.source = serializer.serialize(state.doc.slice(from, to).content, {
        softBreak: true,
      });
    }

    if (writingAction !== "custom") {
      void this.run();
    }
  }

  private run = async (instruction?: string) => {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;

    this.setState({ status: "streaming", output: "", error: "" });

    try {
      const response = await fetch("/api/ai.write", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: this.action,
          text: this.source,
          instruction,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || response.statusText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        this.setState({
          output: this.output + decoder.decode(value, { stream: true }),
        });
      }
      if (!this.output.trim()) {
        throw new Error(this.options.dictionary.aiNoContent);
      }
      this.setState({ status: "done" });
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      this.setState({ status: "error", error: err.message });
    }
  };

  @action
  private setState(state: {
    status?: AIWritingStatus;
    output?: string;
    error?: string;
  }) {
    Object.assign(this, state);
  }

  private insert = (replace: boolean) => {
    const { view } = this.editor;
    const markdown = this.output.trim();
    if (!markdown) {
      return;
    }

    const parsed = this.editor.pasteParser.parse(
      normalizePastedMarkdown(markdown)
    );
    if (!parsed) {
      return;
    }

    const from = replace ? this.from : this.to;
    const to = replace ? this.to : this.to;
    const slice = new Slice(parsed.content, 0, 0);
    const tr = view.state.tr.replaceRange(from, to, slice);
    view.dispatch(tr.scrollIntoView());
    view.focus();
    this.close();
  };

  @action
  private close = () => {
    this.controller?.abort();
    this.open = false;
    this.status = "idle";
    this.output = "";
  };
}
