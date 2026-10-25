// NL-54 AC-12 wiring.
import { describe, expect, it } from "vitest";
import type { WebDeps } from "../deps.ts";
import { BoardService } from "../services/board-service.ts";
import { HeartbeatService } from "../services/heartbeat-service.ts";
import { wire_metrics } from "./metrics.ts";

describe("wire_metrics", () => {
  it("container_resolves_board_and_heartbeats", () => {
    const boom = (): never => {
      throw new Error("db must not be touched at wiring time");
    };
    const trap = new Proxy({}, { get: boom });
    const out = wire_metrics({
      settings: { heartbeat_merge_gap_s: 60, heartbeat_min_spacing_s: 5 },
      db: trap, ids: trap, clock: trap,
    } as unknown as WebDeps);
    expect(out.board).toBeInstanceOf(BoardService);
    expect(out.heartbeats).toBeInstanceOf(HeartbeatService);
  });
});
