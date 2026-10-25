import { EDITOR_SCHEMA, NODE_NAMES, assert_known_nodes } from "@ls/editor-schema/schema";
import { DOMParser as PMParser } from "prosemirror-model";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { prosemirrorToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "y-prosemirror";

// jsdom has no layout, so view.pasteHTML is not used: the same HTML goes through the schema's own DOMParser,
// which is the path a paste takes, and the result is stored through y-prosemirror like a real edit.
const HTML =
  '<img src=x onerror=alert(1)><script>alert(1)</script><p>&lt;img src=x onerror=alert(1)&gt;</p><b>bold</b>';

describe("EDITOR_SCHEMA allow-list on pasted markup", () => {
  const dom = new DOMParser().parseFromString(`<body>${HTML}</body>`, "text/html").body;
  const slice = PMParser.fromSchema(EDITOR_SCHEMA).parse(dom);
  const frag = new Y.Doc().getXmlFragment("section:t");
  prosemirrorToYXmlFragment(slice, frag);
  const json = yXmlFragmentToProsemirrorJSON(frag) as { content?: unknown[] };

  it("stores only allow-listed nodes", () => {
    expect(() => assert_known_nodes(json as never, 1)).not.toThrow();
    const names: string[] = [];
    const walk = (n: unknown) => {
      const o = n as { type?: string; content?: unknown[] };
      if (o.type) names.push(o.type);
      o.content?.forEach(walk);
    };
    walk(json);
    for (const n of names) expect([...NODE_NAMES, "text"]).toContain(n);
  });

  it("keeps the markup as plain text and never as elements", () => {
    const flat = JSON.stringify(json);
    expect(flat).toContain("<img src=x onerror=alert(1)>");
    expect(flat).not.toMatch(/"type":"(img|script|iframe)"/);
  });
});
