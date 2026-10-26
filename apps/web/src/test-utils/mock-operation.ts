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
    // With no API prefix a glob like **/units also matches the app page of the same name; leave page loads to the app.
    if (route.request().resourceType() === "document") return route.fallback();
    // Fetched from Node so the session cookie Prism's security scheme wants can be sent (a browser cannot set Cookie).
    // A request still in flight when the test ends (e.g. the frame's background /units read) is not a failure.
    const response = await route
      .fetch({
        headers: {
          ...route.request().headers(),
          cookie: `${COLLAB_COOKIE.name}=${COLLAB_COOKIE.value}`,
          ...(prefer ? { prefer } : {}),
        },
      })
      .catch((e: unknown) => (/Test ended|closed/.test(String(e)) ? null : Promise.reject(e)));
    if (!response) return;
    // unrouteAll / test end can dispose the fetched response before it is handed back; that request no longer matters.
    await route
      .fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": "*" } })
      .catch((e: unknown) => (/disposed|Test ended|closed/.test(String(e)) ? undefined : Promise.reject(e)));
  });
}
