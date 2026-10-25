// Wraps a throwing check rule so the log can name the rule. The message is fixed on purpose:
// the cause's own message may hold lesson text.
export class RuleFailure extends Error {
  readonly kind: string;
  readonly cause_name: string;

  constructor(kind: string, cause: unknown) {
    super("rule_failed");
    this.name = "RuleFailure";
    this.kind = kind;
    this.cause_name = cause instanceof Error ? cause.name : "unknown";
  }
}
