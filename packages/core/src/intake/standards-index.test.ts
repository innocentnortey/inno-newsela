import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  StandardsIndex,
  load_eld_sheet_codes,
  load_eld_verdicts,
  load_standard_rows,
  load_standards_index,
  type StandardRow,
} from "./standards-index";

const repo_root = fileURLToPath(new URL("../../../../", import.meta.url));

let index: StandardsIndex;
let rows: StandardRow[];
let source_ccss_codes: string[];

beforeAll(() => {
  index = load_standards_index();
  rows = load_standard_rows();
  const doc = fs.readFileSync(
    path.join(repo_root, "docs/source/05-standards-referenced.md"),
    "utf8",
  );
  const section =
    doc
      .split("## CA CCSS for ELA/Literacy")[1]
      ?.split("## CA ELD Standards")[0] ?? "";
  source_ccss_codes = [
    ...section.matchAll(/^\| `([A-Z]+\.6\.[0-9a-z.]+)`/gm),
  ].map((m) => m[1] ?? "");
});

describe("wp1_codes", () => {
  it("RL.6.1 is ok", () => {
    const r = index.resolve("RL.6.1");
    expect(r.status).toBe("ok");
    expect(r.resolved).toEqual(["RL.6.1"]);
    expect(r.eld_label_mismatch).toBe(false);
  });
  it("6.2 is malformed with a null suggestion", () => {
    const r = index.resolve("6.2");
    expect(r.status).toBe("malformed");
    expect(r.suggestion).toBeNull();
    expect(r.resolved).toEqual([]);
  });
  it("L.6.4 is a parent listing its four leaves", () => {
    const r = index.resolve("L.6.4");
    expect(r.status).toBe("parent");
    expect(r.resolved).toEqual(["L.6.4.a", "L.6.4.b", "L.6.4.c", "L.6.4.d"]);
  });
  it("RL.6.9.a is unknown and suggests RL.6.9", () => {
    const r = index.resolve("RL.6.9.a");
    expect(r.status).toBe("unknown");
    expect(r.suggestion).toBe("RL.6.9");
    expect(r.resolved).toEqual([]);
  });
  it("ELD.PII.6.5 with the sheet label is a mismatch suggesting ELD.PII.6.2b", () => {
    const r = index.resolve("ELD.PII.6.5", "Use transitions to connect ideas");
    expect(r.status).toBe("ok");
    expect(r.eld_label_mismatch).toBe(true);
    expect(r.suggestion).toBe("ELD.PII.6.2b");
  });
});

describe("wp5_control", () => {
  it.each([
    ["RL.6.1", null],
    ["L.6.4.c", null],
    ["L.6.6", null],
    ["ELD.PI.6.6b", "Reading/viewing closely"],
    ["ELD.PI.6.7", "Evaluating language choices"],
    ["ELD.PII.6.2b", "Understanding cohesion"],
  ])("%s resolves ok with no false alarm", (code, label) => {
    const r = index.resolve(code, label);
    expect(r.status).toBe("ok");
    expect(r.resolved).toEqual([code]);
    expect(r.eld_label_mismatch).toBe(false);
  });
});

describe("seed_complete", () => {
  it("has 12 ELD sheet codes and 5 MSLS rows", () => {
    expect(load_eld_sheet_codes()).toHaveLength(12);
    expect(rows.filter((r) => r.set === "MSLS_6")).toHaveLength(5);
  });
  it("every CCSS code of the source document has text, except the invalid RL.6.9.a", () => {
    expect(source_ccss_codes.length).toBeGreaterThan(60);
    for (const code of source_ccss_codes) {
      if (code === "RL.6.9.a") continue;
      expect(index.text_of(code), code).toBeTruthy();
    }
    expect(index.text_of("RL.6.9.a")).toBeNull();
  });
  it("lists the parents' full official leaves (W.6.9.b, SL.6.4.a)", () => {
    expect(index.leaves_of("W.6.9")).toEqual(["W.6.9.a", "W.6.9.b"]);
    expect(index.leaves_of("SL.6.4")).toEqual(["SL.6.4.a"]);
  });
  it("has no row with blank text", () => {
    expect(rows.filter((r) => r.text.trim() === "")).toEqual([]);
  });
  it("every ELD sheet code and every leaf has all three tiers with text", () => {
    for (const row of rows.filter(
      (r) => r.set === "CA_ELD_6" && r.is_leaf && !/\.(Em|Ex|Br)$/.test(r.code),
    )) {
      for (const tier of ["Em", "Ex", "Br"]) {
        expect(
          index.text_of(`${row.code}.${tier}`),
          `${row.code}.${tier}`,
        ).toBeTruthy();
      }
      expect(index.text_of(`${row.code}.Ex`)).toBe(row.text);
    }
    for (const code of load_eld_sheet_codes())
      expect(index.text_of(code), code).toBeTruthy();
  });
  it("a tier code resolves to its base", () => {
    const r = index.resolve("ELD.PI.6.7.Em");
    expect(r.status).toBe("ok");
    expect(r.resolved).toEqual(["ELD.PI.6.7"]);
  });
  it("ELD.PI.6.6 is a parent listing 6a, 6b, 6c", () => {
    const r = index.resolve("ELD.PI.6.6");
    expect(r.status).toBe("parent");
    expect(r.resolved).toEqual(["ELD.PI.6.6a", "ELD.PI.6.6b", "ELD.PI.6.6c"]);
  });
  it("2.1.a is malformed with the MSLS suggestion", () => {
    const r = index.resolve("2.1.a");
    expect(r.status).toBe("malformed");
    expect(r.suggestion).toBe("MSLS 2.1a");
  });
});

describe("official_text_only", () => {
  it("never takes text or strand from the sheet label", () => {
    const label = "Summarize key ideas accurately";
    const r = index.resolve("ELD.PI.6.2", label);
    expect(r.eld_label_mismatch).toBe(true);
    expect(index.strand_of("ELD.PI.6.2")).toBe(
      "Interacting via written English",
    );
    const text = index.text_of("ELD.PI.6.2");
    expect(text).not.toContain(label);
    expect(text).toBe(rows.find((x) => x.code === "ELD.PI.6.2")?.text);
    expect(JSON.stringify(r)).not.toContain(label);
  });
});

describe("verdict_counts", () => {
  it("is 3 fits, 2 partial, 7 mismatch over the 12 sheet codes", () => {
    const table = load_eld_verdicts();
    const by = (v: string) =>
      Object.values(table)
        .filter((e) => e.verdict === v)
        .map((e) => e.code.replace("ELD.", "").replace(".6.", "."))
        .sort();
    expect(Object.keys(table)).toHaveLength(12);
    expect(by("fits")).toEqual(["PI.1", "PI.10", "PII.4"]);
    expect(by("partial")).toEqual(["PI.6", "PI.7"]);
    expect(by("mismatch")).toEqual([
      "PI.2",
      "PI.4",
      "PI.5",
      "PII.1",
      "PII.3",
      "PII.5",
      "PII.6",
    ]);
  });
});

describe("rows_equal_files", () => {
  it("an index built from round-tripped, shuffled rows answers like the file index", () => {
    const shuffled = (
      JSON.parse(JSON.stringify(rows)) as StandardRow[]
    ).reverse();
    const from_rows = StandardsIndex.from_rows(shuffled, load_eld_verdicts());
    const codes = rows.map((r) => r.code).sort();
    const stride = Math.floor(codes.length / 50);
    const sample = Array.from(
      { length: 50 },
      (_, i) => codes[i * stride] as string,
    );
    expect(new Set(sample).size).toBe(50);
    for (const code of sample) {
      expect(from_rows.resolve(code)).toEqual(index.resolve(code));
      if (code.startsWith("ELD.")) {
        expect(from_rows.resolve(code, "Maintain formal style")).toEqual(
          index.resolve(code, "Maintain formal style"),
        );
      }
      expect(from_rows.leaves_of(code)).toEqual(index.leaves_of(code));
      expect(from_rows.text_of(code)).toEqual(index.text_of(code));
    }
  });
});

describe("pure_after_load", () => {
  it("resolves with fs stubbed to throw", () => {
    const boom = () => {
      throw new Error("fs used after load");
    };
    const spies = (["readFileSync", "readdirSync", "existsSync"] as const).map(
      (fn) => vi.spyOn(fs, fn).mockImplementation(boom),
    );
    try {
      const codes = [
        "RL.6.1",
        "6.2",
        "L.6.4",
        "RL.6.9.a",
        "ELD.PII.6.5",
        "ELD.PI.6.7.Em",
        "MSLS 2.1a",
        "W.6.9",
        "SL.6.4",
        "L.6.6",
      ];
      for (const code of codes) {
        index.resolve(code, "Use transitions to connect ideas");
        index.leaves_of(code);
        index.text_of(code);
      }
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });
});
