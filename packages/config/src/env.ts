import Decimal from "decimal.js";
import { z } from "zod";
import { ConfigError } from "./errors.ts";
import { SecretStr } from "./secret.ts";

export type Env = Record<string, string | undefined>;

function raw_of(env: Env, name: string): string | undefined {
  const v = env[name];
  return v === undefined || v === "" ? undefined : v;
}

// Never copies a zod message: those can echo the input.
function fail(name: string, error: z.ZodError): never {
  const range = error.issues.some((i) => i.code === "too_small" || i.code === "too_big");
  throw new ConfigError(name, range ? "out of range" : "malformed");
}

function parse<T>(name: string, schema: z.ZodType<T>, raw: string): T {
  const r = schema.safeParse(raw);
  if (!r.success) fail(name, r.error);
  return r.data;
}

export function read_string(env: Env, name: string, opts: { default?: string } = {}): string {
  const raw = raw_of(env, name);
  if (raw === undefined) {
    if (opts.default === undefined) throw new ConfigError(name, "missing");
    return opts.default;
  }
  return parse(name, z.string().min(1), raw);
}

export function read_optional_string(env: Env, name: string): string | null {
  const raw = raw_of(env, name);
  return raw === undefined ? null : parse(name, z.string().min(1), raw);
}

export function read_int(
  env: Env,
  name: string,
  opts: { default?: number; min: number; max?: number },
): number {
  const raw = raw_of(env, name);
  if (raw === undefined) {
    if (opts.default === undefined) throw new ConfigError(name, "missing");
    return opts.default;
  }
  const schema = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(opts.min)
        .max(opts.max ?? Number.MAX_SAFE_INTEGER),
    );
  return parse(name, schema, raw);
}

export function read_decimal(env: Env, name: string, opts: { default: string }): Decimal {
  const raw = raw_of(env, name);
  if (raw === undefined) return new Decimal(opts.default);
  parse(name, z.string().regex(/^\d+(\.\d+)?$/), raw);
  return new Decimal(raw);
}

export function read_bool(env: Env, name: string, opts: { default: boolean }): boolean {
  const raw = raw_of(env, name);
  if (raw === undefined) return opts.default;
  const v = parse(name, z.string().regex(/^(true|false)$/i), raw);
  return v.toLowerCase() === "true";
}

export function read_enum<const T extends readonly string[]>(
  env: Env,
  name: string,
  values: T,
  opts: { default?: T[number] } = {},
): T[number] {
  const raw = raw_of(env, name);
  if (raw === undefined) {
    if (opts.default === undefined) throw new ConfigError(name, "missing");
    return opts.default;
  }
  const hit = values.find((v) => v === raw);
  if (hit === undefined) throw new ConfigError(name, "malformed");
  return hit;
}

export function read_url(
  env: Env,
  name: string,
  protocols: readonly string[],
  opts: { default?: string } = {},
): string {
  const raw = raw_of(env, name);
  if (raw === undefined) {
    if (opts.default === undefined) throw new ConfigError(name, "missing");
    return opts.default;
  }
  let protocol: string;
  try {
    protocol = new URL(raw).protocol;
  } catch {
    throw new ConfigError(name, "malformed");
  }
  if (!protocols.includes(protocol)) throw new ConfigError(name, "malformed");
  return raw;
}

export function read_secret(env: Env, name: string): SecretStr {
  const raw = raw_of(env, name);
  if (raw === undefined) throw new ConfigError(name, "missing");
  return new SecretStr(raw);
}

export function read_optional_secret(env: Env, name: string): SecretStr | null {
  const raw = raw_of(env, name);
  return raw === undefined ? null : new SecretStr(raw);
}

export function read_secret_url(env: Env, name: string, protocols: readonly string[]): SecretStr {
  return new SecretStr(read_url(env, name, protocols));
}
