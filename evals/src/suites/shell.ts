// NL-49: an empty suite. Zero cases makes the CLI exit 2, so a shell can never read as passing.
import { NotImplemented } from "../errors.ts";
import type { EvalSuite, SuiteName } from "../types.ts";

export function make_shell(name: SuiteName, ticket: string): EvalSuite {
  return {
    name,
    cases: () => [],
    score: async () => {
      throw new NotImplemented(`suite ${name} score`, ticket);
    },
  };
}
