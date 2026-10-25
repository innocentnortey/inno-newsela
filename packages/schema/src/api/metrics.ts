// Mirrors OpenAPI components UnitMetrics, CoverageMatrix (metrics and coverage cards).
import { z } from "zod";
import { NullableText } from "./common.ts";

export const UnitMetrics = z.object({
  north_star: z.object({
    median_minutes: z.number().nullable(),
    n: z.number().int(),
    fast_approvals: z.object({ count: z.number().int(), of: z.number().int() }),
    approved: z.object({ k: z.number().int(), total: z.number().int() }),
    caption: z.string(),
    segment_label: NullableText,
  }),
  quality: z
    .object({
      tiles: z.array(
        z.object({
          id: z.string(),
          value: z.number().nullable(),
          n: z.number().int(),
          label: z.string(),
        }),
      ),
      rating_counts: z.object({
        usable_as_drafted: z.number().int(),
        usable_with_edits: z.number().int(),
        rewritten: z.number().int(),
        n: z.number().int(),
      }),
      seeded_errors: z.object({
        planted: z.number().int(),
        caught: z.number().int(),
        label: z.string(),
      }),
    })
    .nullable(),
});
export type UnitMetrics = z.infer<typeof UnitMetrics>;

export const CoverageMatrix = z.object({
  standards: z.array(
    z.object({
      code: z.string(),
      official_text: z.string(),
      never_assessed: z.boolean(),
    }),
  ),
  lessons: z.array(z.object({ lesson_id: z.string(), number: z.number().int().nullable() })),
  cells: z.array(
    z.object({
      code: z.string(),
      lesson_id: z.string(),
      roles: z.array(z.enum(["I", "P", "A"])),
      confirmed_by: z.enum(["person", "judge_only", "generator_only"]),
      source: z.enum(["approved", "working"]),
    }),
  ),
});
export type CoverageMatrix = z.infer<typeof CoverageMatrix>;
