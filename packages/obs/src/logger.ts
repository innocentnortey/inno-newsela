import { SecretStr } from "@ls/config/secret";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  request_id?: string | null;
  run_id?: string | null;
  lesson_id?: string | null;
  job_id?: string | null;
  store_id?: string | null;
  duration_ms?: number | null;
  extra?: unknown;
}

export interface Logger {
  info(event: string, fields: LogFields): void;
  warn(event: string, fields: LogFields): void;
  error(event: string, fields: LogFields): void;
}

export interface LoggerOptions {
  service: string;
  build_id: string;
  level?: LogLevel;
  write?: (line: string) => void;
  now?: () => Date;
}

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_STRING = 120;
const MAX_DEPTH = 5;
const CORRELATION = ["request_id", "run_id", "lesson_id", "job_id", "store_id", "duration_ms"] as const;

function sanitize(value: unknown, depth: number): unknown {
  if (value instanceof SecretStr) return "[redacted]";
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return value.length > MAX_STRING ? "[omitted: too long]" : value;
    case "number":
    case "boolean":
      return value;
    case "undefined":
      return undefined;
    case "object":
      break;
    default:
      return "[omitted: unsupported]";
  }
  if (value instanceof Error) return value.name;
  if (depth >= MAX_DEPTH) return "[omitted: too deep]";
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = sanitize(v, depth + 1);
  return out;
}

export function create_logger(opts: LoggerOptions): Logger {
  const threshold = ORDER[opts.level ?? "info"];
  const write = opts.write ?? ((line: string) => void process.stdout.write(line + "\n"));
  const now = opts.now ?? (() => new Date());

  function emit(level: LogLevel, event: string, fields: LogFields): void {
    if (ORDER[level] < threshold) return;
    try {
      const obj: Record<string, unknown> = {
        ts: now().toISOString(),
        level,
        event,
        service: opts.service,
        build_id: opts.build_id,
      };
      for (const k of CORRELATION) {
        const v = fields[k];
        if (v !== null && v !== undefined) obj[k] = sanitize(v, 0);
      }
      if (fields.extra !== undefined) obj.extra = sanitize(fields.extra, 0);
      write(JSON.stringify(obj));
    } catch {
      try {
        write('{"level":"error","event":"log.failed"}');
      } catch {
        // the logger never throws
      }
    }
  }

  return {
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
  };
}
