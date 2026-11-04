import MarkdownIt from "markdown-it";

/** The info string used for fenced code blocks that contain a drawing. */
export const EXCALIDRAW_FENCE = "excalidraw";

/**
 * Turn fenced code blocks with the `excalidraw` info string into drawing
 * tokens so that they are parsed into the excalidraw node.
 */
export default function excalidraw(md: MarkdownIt) {
  md.core.ruler.after("block", "excalidraw", (state) => {
    for (const token of state.tokens) {
      if (token.type === "fence" && token.info.trim() === EXCALIDRAW_FENCE) {
        token.type = "excalidraw";
      }
    }
    return false;
  });
}
