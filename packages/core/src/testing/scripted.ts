export class UnscriptedCall extends Error {
  readonly method: string;
  constructor(method: string) {
    super(`unscripted call: ${method}`);
    this.name = "UnscriptedCall";
    this.method = method;
  }
}

export interface RecordedCallEntry {
  readonly method: string;
  readonly args: readonly unknown[];
}

type ScriptValue<P, K extends keyof P> = P[K] extends (...a: never[]) => infer R ? Awaited<R> : never;
type Outcome = { readonly kind: "value"; readonly value: unknown } | { readonly kind: "error"; readonly error: Error };

// Per-method queues of results/errors, each consumed once. An empty queue throws UnscriptedCall.
export class Script<P> {
  readonly calls: RecordedCallEntry[] = [];
  private readonly queues = new Map<string, Outcome[]>();

  returns<K extends keyof P & string>(method: K, ...values: ScriptValue<P, K>[]): this {
    for (const value of values) this.queue(method).push({ kind: "value", value });
    return this;
  }

  throws<K extends keyof P & string>(method: K, ...errors: Error[]): this {
    for (const error of errors) this.queue(method).push({ kind: "error", error });
    return this;
  }

  take(method: string, args: readonly unknown[]): unknown {
    this.calls.push({ method, args });
    const next = this.queues.get(method)?.shift();
    if (next === undefined) throw new UnscriptedCall(method);
    if (next.kind === "error") throw next.error;
    return next.value;
  }

  private queue(method: string): Outcome[] {
    let q = this.queues.get(method);
    if (q === undefined) {
      q = [];
      this.queues.set(method, q);
    }
    return q;
  }
}
