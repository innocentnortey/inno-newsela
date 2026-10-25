import { api, ApiError } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { unitIdFromKey } from "@/lib/keys";
import type { LessonState } from "./board-state";

export type UnitBoard = components["schemas"]["UnitBoard"];
export type UnitMetrics = components["schemas"]["UnitMetrics"];
export type Unit = components["schemas"]["Unit"];

export interface BoardResult {
  filter: LessonState | null;
  board: UnitBoard;
}

// NL-98: the routes validate G6.U4 (CON-9/10 path param); the screen holds the url key g6-u4.
const unitId = (unitKey: string): string => unitIdFromKey(unitKey) ?? unitKey;

function noData(): ApiError {
  return new ApiError({ status: 0, code: "NETWORK", message: "No data" });
}

export async function fetchBoard(unitKey: string, filter: LessonState | null): Promise<BoardResult> {
  const { data } = await api.GET("/units/{unitId}/board", {
    params: { path: { unitId: unitId(unitKey) }, query: filter ? { state: filter } : undefined },
  });
  if (!data) throw noData();
  return { filter, board: data };
}

export async function fetchMetrics(unitKey: string): Promise<UnitMetrics> {
  const { data } = await api.GET("/units/{unitId}/metrics", { params: { path: { unitId: unitId(unitKey) } } });
  if (!data) throw noData();
  return data;
}

export async function fetchUnit(unitKey: string): Promise<Unit | null> {
  const { data } = await api.GET("/units", {});
  if (!data) throw noData();
  return data.units.find((u) => u.unit_key === unitKey) ?? null;
}
