import { afterEach, describe, expect, it } from "vitest";
import { create_late_key_capture, printable_key } from "@/editor/late-keys";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

function setup(editable = true) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const other = document.createElement("input");
  document.body.appendChild(other);
  let t = 1000;
  let ed = editable;
  const got: string[] = [];
  const cap = create_late_key_capture({
    root,
    doc: document,
    is_editable: () => ed,
    on_text: (s) => got.push(s),
    now: () => t,
  });
  cleanups.push(() => {
    cap.dispose();
    root.remove();
    other.remove();
  });
  const press = (key: string, el: Element = root) =>
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  return {
    root,
    other,
    got,
    cap,
    press,
    tick: (n: number) => (t += n),
    set_editable: (v: boolean) => (ed = v),
  };
}

describe("late-keys", () => {
  it("printable_key returns the character and rejects shortcuts, Enter and composition", () => {
    const k = { ctrlKey: false, metaKey: false, altKey: false };
    expect(printable_key({ key: "b", ...k })).toBe("b");
    expect(printable_key({ key: "Enter", ...k })).toBeNull();
    expect(printable_key({ key: "b", ...k, ctrlKey: true })).toBeNull();
    expect(printable_key({ key: "b", ...k, metaKey: true })).toBeNull();
    expect(printable_key({ key: "b", ...k, altKey: true })).toBeNull();
    expect(printable_key({ key: "b", ...k, isComposing: true })).toBeNull();
  });

  it("captures printable keys after arm when engaged", () => {
    const s = setup();
    s.press("a");
    s.tick(100);
    s.set_editable(false);
    s.cap.arm();
    s.press("0", s.root);
    s.tick(100);
    s.press("6", document.body);
    expect(s.got).toEqual(["0", "6"]);
  });

  it("ignores keys when never engaged", () => {
    const s = setup();
    s.set_editable(false);
    s.cap.arm();
    s.press("x");
    expect(s.got).toEqual([]);
  });

  it("ignores keys aimed at an input outside the editor", () => {
    const s = setup();
    s.press("a");
    s.set_editable(false);
    s.cap.arm();
    s.press("z", s.other);
    expect(s.got).toEqual([]);
  });

  it("stops after the idle gap", () => {
    const s = setup();
    s.press("a");
    s.set_editable(false);
    s.cap.arm();
    s.press("1");
    s.tick(1500);
    s.press("2");
    expect(s.got).toEqual(["1"]);
  });

  it("does not record engagement while read-only", () => {
    const s = setup(false);
    s.press("a");
    s.cap.arm();
    s.press("b");
    expect(s.got).toEqual([]);
  });

  it("dispose removes the listener", () => {
    const s = setup();
    s.press("a");
    s.set_editable(false);
    s.cap.arm();
    s.cap.dispose();
    s.press("b");
    expect(s.got).toEqual([]);
  });
});
