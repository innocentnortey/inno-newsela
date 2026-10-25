export type ConfigProblem =
  | "missing"
  | "malformed"
  | "out of range"
  | "required when MODEL_PROVIDER_MODE=real";

export class ConfigError extends Error {
  readonly variable: string;
  readonly problem: string;
  constructor(variable: string, problem: string) {
    super(`${variable}: ${problem}`);
    this.name = "ConfigError";
    this.variable = variable;
    this.problem = problem;
    // Stack frames carry paths and line numbers, never values; keep only the name and message so
    // nothing but the variable and the fixed problem text can appear in a serialised error.
    this.stack = `${this.name}: ${this.message}`;
  }
}
