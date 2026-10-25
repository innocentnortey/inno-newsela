// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const generated = path.resolve(root, "../../docs/contracts/generated/api-types.ts");
const mine = path.resolve(root, "src/lib/api-types.ts");

describe("api-types", () => {
  it("is byte-identical to the contract's generated file", () => {
    expect(readFileSync(mine, "utf8")).toBe(readFileSync(generated, "utf8"));
  });

  it("matches a fresh openapi-typescript run over the OpenAPI", () => {
    const out = path.join(mkdtempSync(path.join(os.tmpdir(), "nl24-")), "api-types.ts");
    execFileSync(
      path.resolve(root, "../../node_modules/.bin/openapi-typescript"),
      [path.resolve(root, "../../docs/contracts/interface.openapi.yaml"), "-o", out],
      { stdio: "pipe" },
    );
    expect(readFileSync(out, "utf8")).toBe(readFileSync(generated, "utf8"));
  });
});
