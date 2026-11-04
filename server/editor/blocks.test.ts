import {
  parseBlockData,
  safeImageSource,
} from "@shared/editor/lib/smartBlocks";
import { ProsemirrorHelper as SharedHelper } from "@shared/utils/ProsemirrorHelper";
import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";
import { parser, schema, serializer } from ".";

const p = (text: string) =>
  schema.nodes.paragraph.create(undefined, schema.text(text));
const column = (...content: ReturnType<typeof p>[]) =>
  schema.nodes.column.create(undefined, content);

describe("columns node", () => {
  it("should round trip a layout through markdown", () => {
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.columns.create(undefined, [
        column(p("left")),
        column(
          schema.nodes.container_notice.create({ style: "info" }, [p("tip")]),
          p("right")
        ),
      ]),
      p("after"),
    ]);
    const markdown = serializer.serialize(doc);
    expect(markdown).toMatch(/:::::columns\n::::column\nleft\s*\n::::/);
    const parsed = parser.parse(markdown);
    expect(parsed.toJSON()).toEqual(doc.toJSON());
  });

  it("should round trip nested layouts", () => {
    const inner = schema.nodes.columns.create(undefined, [
      column(p("a")),
      column(p("b")),
    ]);
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.columns.create(undefined, [
        schema.nodes.column.create(undefined, [inner]),
        column(p("c")),
      ]),
    ]);
    const markdown = serializer.serialize(doc);
    expect(markdown).toContain(":::::::columns");
    expect(parser.parse(markdown).toJSON()).toEqual(doc.toJSON());
  });

  it("should still parse notices", () => {
    const doc = parser.parse(":::warning\ncareful\n:::");
    expect(doc.firstChild?.type.name).toEqual("container_notice");
    expect(doc.firstChild?.attrs.style).toEqual("warning");
  });

  it("should render columns in HTML", () => {
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.columns.create(undefined, [column(p("a")), column(p("b"))]),
    ]);
    const html = ProsemirrorHelper.toHTML(doc, { includeStyles: false });
    expect(html).toContain('<div class="columns"><div class="column">');
  });
});

describe("smart block node", () => {
  const kanban = JSON.stringify({
    title: "Plan",
    columns: [{ id: "c1", title: "Todo" }],
    tasks: [{ id: "t1", columnId: "c1", text: "write ```code```" }],
  });

  it("should round trip through markdown", () => {
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.smart_block.create({ kind: "kanban", data: kanban }),
      p("after"),
    ]);
    const markdown = serializer.serialize(doc);
    expect(markdown.startsWith("```kanban\n")).toBe(true);
    // Backticks in the data must not end the fence.
    expect(markdown).not.toContain("write ```");
    const parsed = parser.parse(markdown);
    expect(parsed.firstChild?.type.name).toEqual("smart_block");
    expect(JSON.parse(parsed.firstChild?.attrs.data)).toEqual(
      JSON.parse(kanban)
    );
    expect(parsed.lastChild?.textContent).toEqual("after");
  });

  it("should keep unknown fences as code", () => {
    const doc = parser.parse("```kanbanx\n{}\n```");
    expect(doc.firstChild?.type.name).not.toEqual("smart_block");
  });

  it("should expose block text to plain text and HTML", () => {
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.smart_block.create({ kind: "kanban", data: kanban }),
    ]);
    expect(SharedHelper.toPlainText(doc, schema)).toContain("Plan");
    const html = ProsemirrorHelper.toHTML(doc, { includeStyles: false });
    expect(html).toContain('data-kind="kanban"');
  });
});

describe("smart block data", () => {
  it("should fall back to defaults for broken data", () => {
    expect(parseBlockData("poll", "not json").options).toHaveLength(2);
    expect(parseBlockData("calendar", '{"month":"bad"}').month).toMatch(
      /^\d{4}-\d{2}$/
    );
  });

  it("should drop votes for unknown options and extra single choices", () => {
    const data = parseBlockData(
      "poll",
      JSON.stringify({
        multiple: false,
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
        votes: { u1: ["a", "b"], u2: ["x"] },
      })
    );
    expect(data.votes).toEqual({ u1: ["a"] });
  });

  it("should only allow http and relative image sources", () => {
    expect(safeImageSource("javascript:alert(1)")).toEqual("");
    expect(safeImageSource("data:image/png;base64,AA")).toEqual("");
    expect(safeImageSource("//evil.com/a.png")).toEqual("");
    expect(safeImageSource("/api/attachments.redirect?id=1")).toEqual(
      "/api/attachments.redirect?id=1"
    );
    expect(safeImageSource("https://a.com/b.png")).toEqual(
      "https://a.com/b.png"
    );
  });

  it("should drop tasks of missing columns", () => {
    const data = parseBlockData(
      "kanban",
      JSON.stringify({
        columns: [{ id: "c1", title: "A" }],
        tasks: [
          { id: "t1", columnId: "c1", text: "ok" },
          { id: "t2", columnId: "nope", text: "lost" },
        ],
      })
    );
    expect(data.tasks.map((task) => task.id)).toEqual(["t1"]);
  });
});
