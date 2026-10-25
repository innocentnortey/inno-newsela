import type { Page } from "@playwright/test";
import type { components } from "../lib/api-types";
import { errorStatus, operationRoute, type ErrorCode, type OperationId } from "./operations";
import { apiGlob } from "./sign-in-as";

export async function respondWithError(
  page: Page,
  id: OperationId,
  code: ErrorCode,
  details?: Record<string, unknown>,
): Promise<void> {
  const { method, path } = operationRoute(id);
  const body: components["schemas"]["Error"] = {
    error: { code, message: "Test message for " + code, details: details ?? {} },
  };
  await page.route(apiGlob(path.replace(/\{[^}]+\}/g, "*")), (route) => {
    if (route.request().method().toLowerCase() !== method) return route.fallback();
    return route.fulfill({
      status: errorStatus(code),
      contentType: "application/json",
      headers: { "x-request-id": "req-test", "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id" },
      body: JSON.stringify(body),
    });
  });
}
