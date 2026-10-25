// AC-15: undo restores a standard's entry byte for byte; undo of an add removes it. Pure edit_doc on a Y.Doc, no database.
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import type { StandardEdit } from "@ls/core/ports/collab-commands";
import type { Standard } from "@ls/schema/lesson";
import { lesson_to_ydoc } from "@ls/ydoc/convert";
import { wp1 } from "../nl-80.fixtures.ts";
import { edit_doc, type EditPrefetch } from "./edit-doc.ts";

const PRE: EditPrefetch = { candidate: null, standard_text: { code: "NEW.1", official_text: "Synthetic official text" } };
const doc = (): Y.Doc => {
  const d = new Y.Doc();
  Y.applyUpdate(d, lesson_to_ydoc(wp1()));
  return d;
};
const standards = (d: Y.Doc) => d.getMap("front_matter").get("standards") as Standard[];
const std = (decision: StandardEdit["decision"], code: string, restore: Standard | null = null): StandardEdit => ({ kind: "standard", code, decision, restore });

describe("standard_undo_restores_entry [invariant, AC-15]", () => {
  it("confirm then undo with the before entry restores it byte for byte", () => {
    const d = doc();
    const before = standards(d).find((s) => s.code === "RL.6.1")!;
    const snapshot = JSON.stringify(before);
    edit_doc(d, std("confirm", "RL.6.1"), PRE);
    expect(standards(d).find((s) => s.code === "RL.6.1")!.confirmation).toBe("confirmed");
    edit_doc(d, std("undo", "RL.6.1", JSON.parse(snapshot)), PRE);
    expect(JSON.stringify(standards(d).find((s) => s.code === "RL.6.1"))).toBe(snapshot);
    expect(standards(d)).toHaveLength(standards(doc()).length);
  });

  it("undo with restore null removes an added code", () => {
    const d = doc();
    const n = standards(d).length;
    edit_doc(d, std("add", "NEW.1"), PRE);
    expect(standards(d)).toHaveLength(n + 1);
    expect(standards(d).at(-1)).toMatchObject({ code: "NEW.1", origin: "added", confirmation: "open", official_text: "Synthetic official text" });
    edit_doc(d, std("undo", "NEW.1", null), PRE);
    expect(standards(d)).toHaveLength(n);
    expect(standards(d).some((s) => s.code === "NEW.1")).toBe(false);
  });
});
