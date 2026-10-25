// A table-driven test double for the standards lookup. It mirrors NL-15's verdict table;
// swap it for the real index in NL-26/NL-84 integration.
import type { StandardResolution, StandardsLookup } from "../../../src/intake/normalize.ts";

const LEAVES: Readonly<Record<string, string>> = {
  "L.6.1": "abcde", "L.6.2": "ab", "L.6.3": "ab", "L.6.4": "abcd", "L.6.5": "abc",
  "W.6.1": "abcde", "W.6.2": "abcdef", "W.6.3": "abcde", "W.6.9": "ab", "SL.6.1": "abcd", "SL.6.4": "a",
};
const ELD_MISMATCH = new Set([
  "ELD.PI.6.2", "ELD.PI.6.4", "ELD.PI.6.5", "ELD.PII.6.1", "ELD.PII.6.3", "ELD.PII.6.5", "ELD.PII.6.6",
]);

const result = (code: string, p: Partial<StandardResolution>): StandardResolution => ({
  input_code: code, status: "ok", resolved: [code], suggestion: null, eld_label_mismatch: false, ...p,
});

export const standards_double: StandardsLookup = {
  resolve(code, sheet_label = null) {
    if (/^\d+\.\d+/.test(code)) return result(code, { status: "malformed", resolved: [] });
    if (code.startsWith("MSLS")) return result(code, {});
    if (code.startsWith("ELD.")) {
      if (!/^ELD\.P(I|II)\.6\.\d{1,2}[a-z]?$/.test(code)) return result(code, { status: "unknown", resolved: [] });
      const mismatch = sheet_label !== null && ELD_MISMATCH.has(code);
      return result(code, { eld_label_mismatch: mismatch, suggestion: mismatch && code === "ELD.PII.6.5" ? "ELD.PII.6.2b" : null });
    }
    const m = /^((?:RL|RI|W|SL|L)\.6\.\d{1,2})(?:\.([a-z]))?$/.exec(code);
    if (!m) return result(code, { status: "unknown", resolved: [] });
    const parent = m[1] as string;
    const leaves = LEAVES[parent] ?? "";
    if (m[2] === undefined) {
      return leaves ? result(code, { status: "parent", resolved: [...leaves].map((l) => `${parent}.${l}`) }) : result(code, {});
    }
    return leaves.includes(m[2]) ? result(code, {}) : result(code, { status: "unknown", resolved: [], suggestion: parent });
  },
};
