import { createHash } from "node:crypto";
import { DomainRefusal } from "@ls/core/errors";
import { SystemClock, type Clock } from "@ls/core/ports/clock";
import type { FetchedSheet, SheetFetcher } from "@ls/core/ports/sheet-fetcher";

export interface SheetResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}
export type SheetTransport = (
  url: string,
  init: { signal: AbortSignal; redirect: "manual"; headers: Record<string, string> },
) => Promise<SheetResponse>;

export interface GoogleSheetsExportFetcherOptions {
  timeout_ms: number;
  max_bytes: number;
  transport?: SheetTransport;
  clock?: Clock;
  /** Origin of the Sheets service; default Google. Config only lets it move to loopback in stub mode. */
  base_url?: string;
}

const DEFAULT_BASE = "https://docs.google.com";
const MAX_HOPS = 3;
const NOT_PUBLIC = "This sheet is private; share it publicly or upload the file.";
const UNREACHABLE = "Google Sheets did not answer in time. Try again or upload the file.";
const SHEET_PATH = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{1,128})(?:\/|$)/;
const CONTENT_HOST = /^doc-[a-z0-9-]+\.googleusercontent\.com$/;

const invalid = (): DomainRefusal => new DomainRefusal("INVALID_REQUEST", "The sheet link is not valid.", { fields: ["sheet_url"] });
const not_public = (): DomainRefusal => new DomainRefusal("SHEET_NOT_PUBLIC", NOT_PUBLIC, {});
const unreachable = (): DomainRefusal => new DomainRefusal("SHEET_UNREACHABLE", UNREACHABLE, {});
const too_large = (): DomainRefusal => new DomainRefusal("UNSUPPORTED_FILE", "The sheet is larger than 5 MB.", { reason: "too_large" });

/** Strict allow-list parse; the server only ever requests an address it built itself. */
export function parse_sheet_url(sheet_url: string, base_url: string = DEFAULT_BASE): { sheet_id: string; canonical_url: string; export_url: string } {
  if (typeof sheet_url !== "string" || sheet_url.length > 2048) throw invalid();
  let u: URL;
  try {
    u = new URL(sheet_url);
  } catch {
    throw invalid();
  }
  const base = new URL(base_url);
  if (u.origin !== base.origin || u.username !== "" || u.password !== "") throw invalid();
  const m = SHEET_PATH.exec(u.pathname);
  if (m === null) throw invalid();
  const sheet_id = m[1] as string;
  const canonical_url = `${base.origin}/spreadsheets/d/${sheet_id}`;
  return { sheet_id, canonical_url, export_url: `${canonical_url}/export?format=xlsx` };
}

function redirect_allowed(next: URL, base_url: string = DEFAULT_BASE): boolean {
  if (next.username !== "" || next.password !== "") return false;
  if (base_url !== DEFAULT_BASE && next.origin === new URL(base_url).origin) {
    return !(next.pathname.startsWith("/accounts") || next.pathname.includes("ServiceLogin"));
  }
  if (next.protocol !== "https:" || next.port !== "" || next.username !== "" || next.password !== "") return false;
  if (next.hostname !== "docs.google.com" && !CONTENT_HOST.test(next.hostname)) return false;
  if (next.pathname.startsWith("/accounts") || next.pathname.includes("ServiceLogin")) return false;
  return true;
}

export class GoogleSheetsExportFetcher implements SheetFetcher {
  private readonly timeout_ms: number;
  private readonly max_bytes: number;
  private readonly transport: SheetTransport;
  private readonly clock: Clock;
  private readonly base_url: string;

  constructor(opts: GoogleSheetsExportFetcherOptions) {
    this.timeout_ms = opts.timeout_ms;
    this.max_bytes = opts.max_bytes;
    this.transport = opts.transport ?? ((url, init) => globalThis.fetch(url, init) as Promise<SheetResponse>);
    this.clock = opts.clock ?? new SystemClock();
    this.base_url = opts.base_url ?? DEFAULT_BASE;
  }

  async fetch_export(sheet_url: string): Promise<FetchedSheet> {
    const { canonical_url, export_url } = parse_sheet_url(sheet_url, this.base_url);
    const ac = new AbortController();
    const deadline = this.clock.sleep(this.timeout_ms).then((): never => {
      ac.abort();
      throw unreachable();
    });
    deadline.catch(() => {});
    let data: Uint8Array;
    try {
      data = await Promise.race([this.get(export_url, ac), deadline]);
    } catch (e) {
      if (e instanceof DomainRefusal) throw e;
      throw unreachable();
    }
    const sha256 = createHash("sha256").update(data).digest("hex");
    return { url: canonical_url, kind: "xlsx", data, sha256, fetched_at: this.clock.now() };
  }

  private async get(first_url: string, ac: AbortController): Promise<Uint8Array> {
    let url = first_url;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const res = await this.transport(url, {
        signal: ac.signal,
        redirect: "manual",
        headers: {
          accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.1",
          "user-agent": "newsela-lesson-studio/1",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (loc === null) throw unreachable();
        if (hop === MAX_HOPS) throw unreachable();
        let next: URL;
        try {
          next = new URL(loc, url);
        } catch {
          throw not_public();
        }
        if (!redirect_allowed(next, this.base_url)) throw not_public();
        url = next.toString();
        continue;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) throw not_public();
      if (res.status < 200 || res.status >= 300) throw unreachable();
      if ((res.headers.get("content-type") ?? "").toLowerCase().startsWith("text/html")) throw not_public();
      const len = Number(res.headers.get("content-length"));
      if (Number.isFinite(len) && len > this.max_bytes) throw too_large();
      if (res.body === null) throw unreachable();
      return this.read_capped(res.body, ac);
    }
    throw unreachable();
  }

  private async read_capped(body: ReadableStream<Uint8Array>, ac: AbortController): Promise<Uint8Array> {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.max_bytes) {
        ac.abort();
        await reader.cancel().catch(() => {});
        throw too_large();
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      out.set(c, at);
      at += c.byteLength;
    }
    return out;
  }
}
