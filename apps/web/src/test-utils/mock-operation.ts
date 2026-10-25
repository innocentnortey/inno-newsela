import type { Page } from "@playwright/test";
import { COLLAB_COOKIE } from "./fixtures";
import { operationRoute, type OperationId } from "./operations";
import { apiGlob } from "./sign-in-as";

/** Ask Prism for a specific status or named example for one operation. */
export async function mockOperation(
  page: Page,
  id: OperationId,
  opts: { code?: number; example?: string } = {},
): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("mockOperation is test-only");
  const { method, path } = operationRoute(id);
  const prefer = [opts.code && `code=${opts.code}`, opts.example && `example=${opts.example}`].filter(Boolean).join(", ");
  await page.route(apiGlob(path.replace(/\{[^}]+\}/g, "*")), async (route) => {
    if (route.request().method().toLowerCase() !== method) return route.fallback();
    // Fetched from Node so the session cookie Prism's security scheme wants can be sent (a browser cannot set Cookie).
    const response = await route.fetch({
      headers: {
        ...route.request().headers(),
        cookie: `${COLLAB_COOKIE.name}=${COLLAB_COOKIE.value}`,
        ...(prefer ? { prefer } : {}),
      },
    });
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": "*" } });
  });
}
