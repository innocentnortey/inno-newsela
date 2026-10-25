// NL-102 helpers: the export API through the signed-in page, and stored-row readers.
import { createHash } from "node:crypto";
import { expect, type APIResponse, type Page } from "@playwright/test";
import { canonical_json } from "@ls/schema/content-hash";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs, type Role, type TestUser } from "../support/users";

export const as = (page: Page, role: Role | TestUser): Promise<TestUser> => signInAs(page, role);
export const exportsApi = (unit_key: string): string => `/api/units/${unit_key}/exports`;
export const exportUrl = (unit_key: string): string => `/units/${unit_key}/export`;
export const origin = (): { Origin: string } => ({ Origin: getStack().baseURL });

export const createExport = (page: Page, unit_key: string): Promise<APIResponse> =>
  page.request.post(exportsApi(unit_key), { headers: origin() });
export const listExports = async (page: Page, unit_key: string): Promise<ListBody> => {
  const res = await page.request.get(exportsApi(unit_key));
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as ListBody;
};
export const download = async (page: Page, export_id: string): Promise<{ status: number; text: string; body: Bundle; headers: Record<string, string> }> => {
  const res = await page.request.get(`/api/exports/${export_id}/download`);
  const text = await res.text();
  let body = {} as Bundle;
  try { body = JSON.parse(text) as Bundle; } catch { /* non-JSON refusal */ }
  return { status: res.status(), text, body, headers: res.headers() };
};

export interface ListBody {
  included: { lesson_id: string; approved_hash: string }[];
  held_back: { lesson_id: string; waits_on: string; reason: string }[];
  exports: { export_id: string; version_number: number; payload_hash: string; lesson_count: number; created_by: string }[];
}
export interface Created {
  export_id: string; version_number: number; same_as_previous: boolean; included: ListBody["included"]; held_back: ListBody["held_back"];
}
export interface Bundle {
  export_version: number; unit_id: string; generated_at: string;
  lessons: { lesson_id: string; version_id: string; content_hash: string; approved_by: string; approved_at: string; lesson: { title: string; sections: unknown[] } }[];
}

/** sha256 of the canonical JSON of the bundle: the same identity the service stores as payload_sha256. */
export const bundleHash = (b: Bundle): string => createHash("sha256").update(canonical_json(b as never), "utf8").digest("hex");

export const exportRows = (unit_id: string) =>
  db().query<{ id: string; version_number: number; payload_sha256: string; lesson_versions_json: string[]; held_back_json: unknown; created_by: string }>(
    "select * from export_bundle where unit_id=$1 order by version_number", [unit_id]);
export const auditRows = (export_id: string) =>
  db().query<{ id: string; actor_id: string; details_json: Record<string, unknown>; request_id: string | null; target_id: string }>(
    "select * from audit_event where action='export.create' and target_id=$1", [export_id]);
export const lessonState = async (lesson_id: string): Promise<string> =>
  (await db().query<{ state: string }>("select state from lesson where id=$1", [lesson_id]))[0]!.state;
export const countAll = async (): Promise<{ bundles: number; audits: number }> => ({
  bundles: await db().count("export_bundle"),
  audits: await db().count("audit_event", "action='export.create'"),
});
