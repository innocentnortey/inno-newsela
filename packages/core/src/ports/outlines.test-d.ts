// NL-12
import type { IntakeChoiceRow as SchemaIntake, LessonLinkRecord as SchemaLink, OutlineVersionRow as SchemaVersion } from "@ls/schema/outline";
import { expectTypeOf } from "vitest";
import type { IntakeChoiceRow, LessonLinkRecord, OutlineVersionRow } from "./outlines.ts";

expectTypeOf<OutlineVersionRow>().toEqualTypeOf<SchemaVersion>();
expectTypeOf<IntakeChoiceRow>().toEqualTypeOf<SchemaIntake>();
expectTypeOf<LessonLinkRecord>().toEqualTypeOf<SchemaLink>();
