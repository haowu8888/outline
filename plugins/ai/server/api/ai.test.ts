import { buildMessages } from "../prompts";
import { parseStreamChunk } from "./ai";

describe("parseStreamChunk", () => {
  it("should extract content deltas and keep the incomplete line", () => {
    const chunk =
      'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n' +
      'data: {"choices":[{"delta":{}}]}\n' +
      ": keep-alive\n" +
      'data: {"choices":[{"delta":{"content":"，世界"}}]}\n' +
      "data: [DONE]\n" +
      'data: {"choices":[{"delta":{"con';
    const { deltas, rest } = parseStreamChunk(chunk);
    expect(deltas).toEqual(["你好", "，世界"]);
    expect(rest).toEqual('data: {"choices":[{"delta":{"con');
  });

  it("should complete a line split across chunks", () => {
    const first = parseStreamChunk('data: {"choices":[{"delta":{"content":"A');
    expect(first.deltas).toEqual([]);
    const second = parseStreamChunk(first.rest + 'B"}}]}\n');
    expect(second.deltas).toEqual(["AB"]);
  });
});

describe("buildMessages", () => {
  it("should include the task and text", () => {
    const messages = buildMessages({ action: "polish", text: "原文" });
    expect(messages[0].role).toEqual("system");
    expect(messages[1].content).toContain("Polish");
    expect(messages[1].content).toContain("原文");
  });

  it("should use the instruction for custom actions", () => {
    const messages = buildMessages({
      action: "custom",
      text: "",
      instruction: "写一首诗",
    });
    expect(messages[1].content).toContain("写一首诗");
  });
});
