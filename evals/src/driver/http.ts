// NL-86: one HTTP call helper with a cookie jar. Logs "op status ms" only: never headers, bodies, the password or the cookie.
import path from "node:path";
import { DriverError, type DriverConfig } from "./types.ts";

export interface CallOpts {
  json?: unknown;
  form?: { field: string; bytes: Uint8Array; filename: string };
  headers?: Record<string, string>;
}
export interface CallResult {
  status: number;
  body: unknown;
}
export type Call = (op: string, method: string, route: string, opts?: CallOpts) => Promise<CallResult>;

export function make_http(cfg: Pick<DriverConfig, "base_url" | "fetch" | "log">): Call {
  let cookie: string | null = null;
  return async (op, method, route, opts = {}) => {
    const headers: Record<string, string> = { accept: "application/json", ...(opts.headers ?? {}) };
    if (cookie !== null) headers["cookie"] = cookie;
    let body: string | FormData | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    } else if (opts.form !== undefined) {
      const fd = new FormData();
      fd.append(opts.form.field, new Blob([opts.form.bytes]), path.basename(opts.form.filename));
      body = fd;
    }
    const t0 = performance.now();
    const res = await cfg.fetch(cfg.base_url.replace(/\/$/, "") + route, { method, headers, ...(body !== undefined ? { body } : {}) });
    cfg.log(`${op} ${res.status} ${Math.round(performance.now() - t0)}ms`);
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const pair = sc.split(";")[0] ?? "";
      if (pair.startsWith("ls_session=")) cookie = pair;
    }
    const text = await res.text();
    const parsed = ((): unknown => {
      try {
        return text === "" ? null : JSON.parse(text);
      } catch {
        return null;
      }
    })();
    if (res.status < 200 || res.status > 299) {
      const err = (parsed as { error?: { code?: unknown } } | null)?.error;
      const code = typeof err?.code === "string" ? err.code : "none";
      throw new DriverError("HTTP_STATUS", `${op} answered ${res.status} (code ${code})`);
    }
    return { status: res.status, body: parsed };
  };
}
