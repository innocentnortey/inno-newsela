import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  make_ctx,
  reading_lesson,
} from "../../test-helpers.ts";

import { vocabulary_over_cap_rule } from "./vocabulary_over_cap.ts";

const with_vocab = (n: number) => {
  const l = reading_lesson();
  return make_ctx({
    ...l,
    front_matter: {
      ...l.front_matter,
      vocabulary: Array.from({ length: n }, (_, i) => `w${i}`),
    },
  });
};

describe("vocabulary_over_cap", () => {
  it("over_cap_one_finding", () => {
    const f = vocabulary_over_cap_rule.run(with_vocab(7), DEFAULT_POLICY);
    expect(f).toHaveLength(1);
    expect(f[0]?.level).toBe("advisory");
    expect(f[0]?.address).toBe("G6.U4.L4.FrontMatter");
  });
  it("at_cap_none", () => {
    expect(vocabulary_over_cap_rule.run(with_vocab(6), DEFAULT_POLICY)).toEqual(
      [],
    );
  });
  it("cap_read_from_policy", () => {
    const small = { ...DEFAULT_POLICY, vocabulary_cap: 2 };
    expect(vocabulary_over_cap_rule.run(with_vocab(3), small)).toHaveLength(1);
    expect(vocabulary_over_cap_rule.run(with_vocab(3), DEFAULT_POLICY)).toEqual(
      [],
    );
  });
});
