import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { covers, derive_client_state, type ClientInputs } from "@/editor/client-state";

const base: ClientInputs = { ever_connected: true, connected: true, synced: true, read_only: false, dirty: false };

describe("derive_client_state", () => {
  it("read_only wins over everything", () => {
    expect(derive_client_state({ ...base, read_only: true, connected: false, dirty: true })).toBe("read_only");
  });
  it("is connecting before the first connect, and a first failed connect is not DISCONNECTED", () => {
    expect(derive_client_state({ ...base, ever_connected: false, connected: false })).toBe("connecting");
  });
  it("is DISCONNECTED after a connect was lost", () => {
    expect(derive_client_state({ ...base, connected: false })).toBe("DISCONNECTED");
  });
  it("is connecting while connected but not yet synced", () => {
    expect(derive_client_state({ ...base, synced: false })).toBe("connecting");
  });
  it("is saving while dirty", () => {
    expect(derive_client_state({ ...base, dirty: true })).toBe("saving");
  });
  it("is synced otherwise", () => {
    expect(derive_client_state(base)).toBe("synced");
  });
});

describe("covers", () => {
  const sv = (f: (d: Y.Doc) => void) => {
    const d = new Y.Doc();
    f(d);
    return Y.encodeStateVector(d);
  };
  it("equal vectors, stored ahead, stored behind, unknown client", () => {
    const d = new Y.Doc();
    d.getText("t").insert(0, "abc");
    const a = Y.encodeStateVector(d);
    d.getText("t").insert(3, "def");
    const b = Y.encodeStateVector(d);
    expect(covers(a, a)).toBe(true);
    expect(covers(b, a)).toBe(true);
    expect(covers(a, b)).toBe(false);
    expect(covers(sv(() => {}), a)).toBe(false);
  });
});
