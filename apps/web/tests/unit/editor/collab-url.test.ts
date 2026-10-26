import { afterEach, describe, expect, it, vi } from "vitest";
import { collab_url } from "../../../src/editor/collab-url.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("collab_url", () => {
  it("env wins over the same-origin fallback", () => {
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:3000" });
    vi.stubEnv("NEXT_PUBLIC_COLLAB_URL", "ws://localhost:1234");
    expect(collab_url()).toBe("ws://localhost:1234");
    vi.stubEnv("NEXT_PUBLIC_COLLAB_URL", "");
    expect(collab_url()).toBe("ws://localhost:3000/collab");
  });
});
