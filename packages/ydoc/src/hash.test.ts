import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import * as schemaHash from "@ls/schema/content-hash";
import * as ydocHash from "./hash.ts";
import { StateVectorError, covers, state_vector_of } from "./hash.ts";

const sv = (doc: Y.Doc) => Buffer.from(Y.encodeStateVector(doc)).toString("base64");
function docWith(id: number, text: string): Y.Doc {
  const d = new Y.Doc();
  d.clientID = id;
  d.getText("t").insert(0, text);
  return d;
}

describe("single_hash_function", () => {
  it("re-exports the schema content_hash", () => {
    expect(Object.is(ydocHash.content_hash, schemaHash.content_hash)).toBe(true);
  });
});

describe("state_vector_of", () => {
  it("matches the encoded state vector", () => {
    const d = docWith(5, "abc");
    expect(state_vector_of(Y.encodeStateAsUpdate(d))).toBe(sv(d));
  });
  it("empty doc is AA==", () => {
    expect(state_vector_of(Y.encodeStateAsUpdate(new Y.Doc()))).toBe("AA==");
  });
  it("grows and covers the first after a second update", () => {
    const a = docWith(5, "abc");
    const first = state_vector_of(Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(docWith(6, "def")));
    const second = state_vector_of(Y.encodeStateAsUpdate(a));
    expect(second).not.toBe(first);
    expect(covers(second, first)).toBe(true);
    expect(covers(first, second)).toBe(false);
  });
});

describe("covers", () => {
  const a = sv(docWith(5, "abc"));
  const ahead = sv(docWith(5, "abcd"));
  const other = sv(docWith(6, "x"));
  it.each([
    ["equal", a, a, true],
    ["client ahead", a, ahead, false],
    ["client has unknown id", a, other, false],
    ["client empty", a, "AA==", true],
  ])("%s", (_n, s, c, want) => {
    expect(covers(s, c)).toBe(want);
  });
  it("malformed text throws", () => {
    expect(() => covers(a, "not base64!")).toThrow(StateVectorError);
  });
  it("bad length throws", () => {
    expect(() => covers(a, "AQ")).toThrow(StateVectorError);
  });
});
