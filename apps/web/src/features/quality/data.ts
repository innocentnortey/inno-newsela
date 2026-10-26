import { api, ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { unitIdFromKey } from "@/lib/keys";

export type UnitMetrics = components["schemas"]["UnitMetrics"];

export async function fetchUnitMetrics(unitKey: string): Promise<UnitMetrics> {
  const unitId = unitIdFromKey(unitKey) ?? unitKey;
  const { data } = await api.GET("/units/{unitId}/metrics", {
    params: { path: { unitId } },
  });
  if (!data) throw new ApiError({ status: 0, code: "NETWORK", message: "No data" });
  return data;
}
