// NL-26 frozen test helper (synthetic only): a scripted transport that records every URL requested.
// Do not edit: hashed in docs/plans/frozen-tests/NL-26.manifest.json.
export interface FakeResponse {
  status: number;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}
export type Script = (url: string, call_index: number) => FakeResponse | Promise<FakeResponse>;

export const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-aBcDe"; // 44 synthetic characters
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;

function headers_of(h: Record<string, string>): { get(name: string): string | null } {
  const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

export function bytes_response(status: number, data: Uint8Array, headers: Record<string, string> = {}): FakeResponse {
  return {
    status,
    headers: headers_of(headers),
    body: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(data);
        c.close();
      },
    }),
  };
}

export function redirect_response(location: string, status = 302): FakeResponse {
  return { status, headers: headers_of({ location }), body: null };
}

export function status_response(status: number): FakeResponse {
  return bytes_response(status, new TextEncoder().encode("denied"), { "content-type": "text/plain" });
}

export class FakeSheetTransport {
  readonly requests: string[] = [];
  constructor(private readonly script: Script) {}
  readonly fn = async (url: string, _init: unknown): Promise<FakeResponse> => {
    this.requests.push(url);
    return this.script(url, this.requests.length - 1);
  };
  hosts(): string[] {
    return this.requests.map((u) => new URL(u).hostname);
  }
}
