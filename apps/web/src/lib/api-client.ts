import createClient from "openapi-fetch";
import type { components, paths } from "./api-types";

export type ApiErrorCode = components["schemas"]["ErrorCode"] | "NETWORK";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, unknown>;
  readonly requestId: string | null;
  constructor(init: {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? {};
    this.requestId = init.requestId ?? null;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

const NETWORK_MESSAGE = "Couldn't reach Lesson Studio. Try again.";

let unauthenticatedHandler: (() => void) | null = null;

/** The session guard installs a handler so a 401 from any call sends the user to sign-in. */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  unauthenticatedHandler = handler;
}

function defaultBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE ?? "") + (process.env.NEXT_PUBLIC_API_PREFIX ?? "/api");
}

function isEnvelope(v: unknown): v is { error: { code: string; message: string; details?: Record<string, unknown> } } {
  if (typeof v !== "object" || v === null) return false;
  const e = (v as { error?: unknown }).error;
  if (typeof e !== "object" || e === null) return false;
  const { code, message } = e as { code?: unknown; message?: unknown };
  return typeof code === "string" && typeof message === "string";
}

export function createApiClient(opts: ApiClientOptions = {}) {
  const baseFetch = opts.fetch;
  const apiFetch = async (input: Request | string | URL, init?: RequestInit): Promise<Response> => {
    const doFetch = baseFetch ?? globalThis.fetch;
    let res: Response;
    try {
      res = await doFetch(input as Request, init);
    } catch {
      throw new ApiError({ status: 0, code: "NETWORK", message: NETWORK_MESSAGE });
    }
    const requestId = res.headers.get("x-request-id");
    if (res.ok) {
      const type = res.headers.get("content-type") ?? "";
      if (res.status === 204 || type.includes("application/json")) return res;
      throw new ApiError({ status: res.status, code: "NETWORK", message: NETWORK_MESSAGE, requestId });
    }
    let body: unknown = null;
    try {
      body = JSON.parse(await res.clone().text());
    } catch {
      body = null;
    }
    const err = isEnvelope(body)
      ? new ApiError({
          status: res.status,
          code: body.error.code as ApiErrorCode,
          message: body.error.message,
          details: body.error.details ?? {},
          requestId,
        })
      : new ApiError({ status: res.status, code: "NETWORK", message: NETWORK_MESSAGE, requestId });
    if (err.code === "UNAUTHENTICATED") unauthenticatedHandler?.();
    throw err;
  };
  return createClient<paths>({
    baseUrl: opts.baseUrl ?? defaultBaseUrl(),
    credentials: "same-origin",
    fetch: apiFetch as typeof fetch,
  });
}

export const api = createApiClient();
