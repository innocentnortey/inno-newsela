// NL-51: CON-23 handlers (listExports, createExport, downloadExport); testable without Next.
import { z } from "zod";
import type { RequestUser } from "@ls/core/ports/common";
import type { ExportCreated, ExportList } from "@ls/schema/api/exports";
import type { ExportBundleFile } from "@ls/schema/export";
import type { JsonValue, make_with_route, RouteHandler } from "@/server/http/with-route.ts";

export interface ExportApi {
  list(user: RequestUser, unit_ref: string): Promise<ExportList>;
  create(user: RequestUser, unit_ref: string): Promise<ExportCreated>;
  download(user: RequestUser, export_id: string): Promise<ExportBundleFile>;
}

// Loose on purpose: an unknown id must be NOT_FOUND, not INVALID_REQUEST.
const UnitParams = z.object({ unitId: z.string().min(1).max(64) });
const ExportParams = z.object({ exportId: z.string().min(1).max(64) });

export function make_export_handlers(d: {
  with_route: ReturnType<typeof make_with_route>;
  exports: () => ExportApi;
}): { list_exports: RouteHandler; create_export: RouteHandler; download_export: RouteHandler } {
  const base = { roles: ["approver"] as const, request_schema: null };
  const list_exports = d.with_route(
    async (user, req) => (await d.exports().list(user, req.path_params["unitId"] ?? "")) as unknown as JsonValue,
    { operation_id: "listExports", success_status: 200, params_schema: UnitParams, ...base },
  );
  const created = d.with_route(
    async (user, req) => (await d.exports().create(user, req.path_params["unitId"] ?? "")) as unknown as JsonValue,
    { operation_id: "createExport", success_status: 201, params_schema: UnitParams, ...base },
  );
  // An unchanged export answers 200, a new version 201 (the route log line keeps 201: accepted limit).
  const create_export: RouteHandler = async (req) => {
    const res = await created(req);
    if (res.status === 201 && (res.body as { same_as_previous?: boolean } | null)?.same_as_previous === true) {
      return { ...res, status: 200 };
    }
    return res;
  };
  const download_export = d.with_route(
    async (user, req) => (await d.exports().download(user, req.path_params["exportId"] ?? "")) as unknown as JsonValue,
    { operation_id: "downloadExport", success_status: 200, params_schema: ExportParams, ...base },
  );
  return { list_exports, create_export, download_export };
}
