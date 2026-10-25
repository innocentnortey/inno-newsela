// NL-49
import type { SuiteName } from "@ls/core/ports/evidence";

export class NotImplemented extends Error {
  readonly ticket: string;
  constructor(what: string, ticket: string) {
    super(`not implemented: ${what} (filled by ${ticket})`);
    this.name = "NotImplemented";
    this.ticket = ticket;
  }
}

export class EmptySuiteError extends Error {
  readonly suite: SuiteName;
  constructor(suite: SuiteName) {
    super(`suite has no cases: ${suite}`);
    this.name = "EmptySuiteError";
    this.suite = suite;
  }
}
