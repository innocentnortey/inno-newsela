# NL-23 accepted risk AR-1

**What.** render.yaml gives all three Render services (web, collab, worker) the owner DB connection string, because Render exposes one URL. The append-only guarantees therefore rest on the BEFORE UPDATE/DELETE/TRUNCATE triggers alone there, not on the non-owner runtime role.

**Why accepted.** Security review finding (High), accepted by the orchestrator under PD-32. The demo runs locally under Docker Compose (PD-15 option D) where the runtime role split applies; Render is committed but not deployed.

**Mitigations present.** BEFORE UPDATE/DELETE/TRUNCATE triggers on the append-only tables; Compose uses the non-owner runtime role.

**Required before any real deployment.** A separate runtime DATABASE_URL for the services, and `apply-runtime-grants` run in a pre-deploy step.
