import type { ErrorCode as ErrorCodeName } from "@ls/schema/api/common";
import { ErrorCode } from "@ls/schema/api/common";
import { ERROR_STATUS } from "./error-status.generated.ts";

// A missing code in the generated table is a compile error.
const _all: Record<ErrorCodeName, number> = ERROR_STATUS;
void _all;

export interface DomainRefusalLike {
  code: ErrorCodeName;
  message: string;
  details?: unknown;
}

export interface ErrorBody {
  error: {
    code: ErrorCodeName;
    message: string;
    details: Record<string, unknown>;
  };
}

export interface ErrorResponse {
  status: number;
  body: ErrorBody;
}

export function status_for(code: ErrorCodeName): number {
  return ERROR_STATUS[code];
}

export function to_error_response(
  refusal: DomainRefusalLike,
  request_id: string,
): ErrorResponse {
  const base =
    typeof refusal.details === "object" &&
    refusal.details !== null &&
    !Array.isArray(refusal.details)
      ? (refusal.details as Record<string, unknown>)
      : {};
  return {
    status: status_for(refusal.code),
    body: {
      error: {
        code: refusal.code,
        message: refusal.message,
        details: { ...base, request_id },
      },
    },
  };
}

// Name-based so a refusal survives module duplication; the code must be a catalog code.
export function is_domain_refusal(e: unknown): e is DomainRefusalLike {
  if (!(e instanceof Error)) return false;
  if (e.name !== "DomainRefusal" && e.constructor.name !== "DomainRefusal")
    return false;
  const code = (e as { code?: unknown }).code;
  return ErrorCode.safeParse(code).success && typeof e.message === "string";
}
