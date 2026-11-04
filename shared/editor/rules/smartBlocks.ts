import MarkdownIt from "markdown-it";
import { isSmartBlockKind } from "../lib/smartBlocks";

/**
 * Turn fenced code blocks whose info string names an interactive block, such
 * as ```kanban, into smart_block tokens. The fence holds the block's JSON.
 */
export default function smartBlocks(md: MarkdownIt) {
  md.core.ruler.after("block", "smart_blocks", (state) => {
    for (const token of state.tokens) {
      if (token.type === "fence" && isSmartBlockKind(token.info.trim())) {
        token.type = "smart_block";
      }
    }
    return false;
  });
}
