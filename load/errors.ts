// NL-49: duplicated from evals/src/errors.ts on purpose (tools may not import each other).
export class NotImplemented extends Error {
  readonly ticket: string;
  constructor(what: string, ticket: string) {
    super(`not implemented: ${what} (filled by ${ticket})`);
    this.name = "NotImplemented";
    this.ticket = ticket;
  }
}
