import MarkdownIt, { Token } from "markdown-it";
import customFence from "markdown-it-container";

export default function notice(md: MarkdownIt): void {
  return customFence(md, "notice", {
    marker: ":",
    // Column layouts use the same marker, see rules/columns.ts
    validate: (params: string) => !/^columns?$/.test(params.trim()),
    render(tokens: Token[], idx: number) {
      const { info } = tokens[idx];

      if (tokens[idx].nesting === 1) {
        // opening tag
        return `<div class="notice notice-${md.utils.escapeHtml(info)}">\n`;
      } else {
        // closing tag
        return "</div>\n";
      }
    },
  });
}
