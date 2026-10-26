// NL-86: the only place the S9/S13 CLI path builds concrete Postgres repos.
import { read_secret_url } from "@ls/config/env";
import type { SharedSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { LessonVersionRepo } from "@ls/core/ports/lesson-versions";
import type { MetricsRepo } from "@ls/core/ports/metrics";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgMetricsRepo } from "@ls/db/repos/metrics";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgOutlineRepo } from "@ls/db/repos/outlines";
import { PgRunRepo } from "@ls/db/repos/runs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FullRunContext } from "./full-run-report.ts";
import { resolve_git_sha } from "./git-sha.ts";
import type { ProviderMode } from "./types.ts";

export interface DefaultDeps {
  ctx: FullRunContext;
  close(): Promise<void>;
  metrics: Pick<MetricsRepo, "unit_metrics_rows">;
  versions_for_s13: Pick<LessonVersionRepo, "approved_snapshots">;
}

export function build_default_deps(env: Record<string, string | undefined>, provider_mode: ProviderMode = "stub"): DefaultDeps {
  const settings: SharedSettings = {
    database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
    pg_pool_max: 2, build_id: env["BUILD_ID"] ?? "dev", log_level: "info",
  };
  const db = new PgDatabase(settings, 2, 5000, "worker");
  const clock = new SystemClock();
  const d = { db, ids: new PrefixedIdGenerator(), clock };
  const lessons = new PgLessonRepo(d);
  const metrics = new PgMetricsRepo(d);
  return {
    ctx: {
      ports: { runs: new PgRunRepo(d), calls: new PgModelCallLog(d), outlines: new PgOutlineRepo(d) },
      evidence: new PgEvidenceRepo(d),
      repo_root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
      git_sha: resolve_git_sha(env), prompt_version_id: null, models: { provider_mode_note: "stub runs make no model call" },
      provider_mode, env,
    },
    close: () => db.close(),
    metrics, versions_for_s13: lessons,
  };
}
