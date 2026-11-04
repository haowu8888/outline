export const AIWritingActions = [
  "continue",
  "polish",
  "expand",
  "shorten",
  "summarize",
  "translate_en",
  "translate_zh",
  "fix",
  "custom",
] as const;

export type AIWritingAction = (typeof AIWritingActions)[number];

const SYSTEM_PROMPT = [
  "You are a writing assistant embedded in a knowledge base editor.",
  "Reply with the resulting text only, formatted as Markdown, without any preface, explanation or code fence around the whole answer.",
  "Keep the language of the source text unless the task asks for a translation.",
  "Preserve facts, names, links, code and numbers exactly.",
].join(" ");

const TASKS: Record<Exclude<AIWritingAction, "custom">, string> = {
  continue:
    "Continue writing after the given text in the same style and language. Return only the new continuation, do not repeat the given text.",
  polish:
    "Polish the given text: improve clarity, flow and wording while keeping its meaning and structure.",
  expand:
    "Expand the given text with more detail, examples and explanation while keeping its meaning.",
  shorten:
    "Make the given text more concise while keeping all key information.",
  summarize: "Summarize the given text as a short list of key points.",
  translate_en: "Translate the given text into English.",
  translate_zh: "Translate the given text into Simplified Chinese.",
  fix: "Fix spelling, grammar and punctuation mistakes in the given text without changing its meaning or style.",
};

/**
 * Build the chat messages for a writing action.
 *
 * @param action The writing action requested.
 * @param text The selected text, or the text before the cursor for `continue`.
 * @param instruction A free form instruction, required for `custom`.
 * @param title The document title, used as additional context.
 * @returns Messages in the OpenAI chat format.
 */
export function buildMessages({
  action,
  text,
  instruction,
  title,
}: {
  action: AIWritingAction;
  text: string;
  instruction?: string;
  title?: string;
}) {
  const task =
    action === "custom"
      ? `Follow this instruction: ${instruction ?? ""}`
      : TASKS[action];
  const context = title ? `Document title: ${title}\n\n` : "";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `${task}\n\n${context}Text:\n"""\n${text}\n"""`,
    },
  ];
}
