import MarkdownIt, { Token } from "markdown-it";
import customFence from "markdown-it-container";

/** Minimum number of colons that open a column layout in Markdown. */
export const COLUMNS_MARKER_LENGTH = 5;

/**
 * Parse column layouts written as nested containers, the layout uses a longer
 * marker than its columns so that notices inside a column keep working:
 *
 * :::::columns
 * ::::column
 * Left
 * ::::
 * ::::column
 * Right
 * ::::
 * :::::
 */
export default function columns(md: MarkdownIt): void {
  for (const name of ["columns", "column"]) {
    customFence(md, name, {
      marker: ":",
      validate: (params: string) => params.trim() === name,
      render(tokens: Token[], idx: number) {
        return tokens[idx].nesting === 1
          ? `<div class="${name}">\n`
          : "</div>\n";
      },
    });
  }
}
