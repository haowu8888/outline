import { ProsemirrorHelper } from "@server/models/helpers/ProsemirrorHelper";
import { parser, schema, serializer } from ".";

const scene = JSON.stringify({
  type: "excalidraw",
  version: 2,
  elements: [{ id: "a", type: "rectangle", x: 0, y: 0 }],
});

describe("excalidraw node", () => {
  it("should parse an excalidraw fence into a drawing", () => {
    const doc = parser.parse("```excalidraw\n" + scene + "\n```\n\nafter");
    expect(doc.firstChild?.type.name).toEqual("excalidraw");
    expect(doc.firstChild?.attrs.data).toEqual(scene);
    expect(doc.lastChild?.textContent).toEqual("after");
  });

  it("should keep other fences as code blocks", () => {
    const doc = parser.parse("```js\nconst a = 1;\n```");
    expect(doc.firstChild?.type.name).not.toEqual("excalidraw");
    expect(doc.firstChild?.textContent).toEqual("const a = 1;");
  });

  it("should round trip through markdown without the preview", () => {
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.excalidraw.create({ data: scene, svg: "<svg></svg>" }),
      schema.nodes.paragraph.create(undefined, schema.text("text")),
    ]);
    const markdown = serializer.serialize(doc);
    expect(markdown).toContain("```excalidraw\n" + scene + "\n```");
    expect(markdown).not.toContain("<svg");
    expect(parser.parse(markdown).firstChild?.attrs.data).toEqual(scene);
  });

  it("should render the preview as an image in HTML", () => {
    const doc = schema.nodes.doc.create(undefined, [
      schema.nodes.excalidraw.create({
        data: scene,
        svg: "<svg><script>alert(1)</script></svg>",
      }),
    ]);
    const html = ProsemirrorHelper.toHTML(doc, { includeStyles: false });
    expect(html).toContain('class="excalidraw-board"');
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain("<script>alert");
  });
});
