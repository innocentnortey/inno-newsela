#!/usr/bin/env bash
# Isolated real-stack e2e runner: ONE serial run of apps/web/e2e/integration/* on a rebuilt, private copy of the candidate tree.
#
# What it proves: the real stack (built Next app, worker, collab, migrated Postgres) with the STUB model. It says nothing about
# paid real-model generation (the run record states claims.paid_real_model_generation = false).
#
# What it prevents (docs/devlog/2026-10-26-e2e-real-stack-final.md): two runs sharing apps/web/.next and
# apps/web/test-results/integration-stack (one wiped the other's stack.json), a stale server on the default port, and the collab
# and assist env that con-17 needs but a hand-written wrapper left out. Here: one flock, a private tree with its own .next and
# stack files, an own migrated database per run (support/db-admin.ts), a fixed env block, and a run record that states the exact
# commit, a hash of the uncommitted files, and whether the run is valid evidence for that commit.
#
# usage: ops/e2e-real-stack.sh [--only con-1,con-2] [--out <dir>] [--keep-tree] [--dry-run] [--print-fingerprint]
# env:   E2E_REPO_ROOT (default: the repo holding this script)  E2E_LOCK_FILE (default /tmp/newsela-e2e-real-stack.lock)
#        E2E_COLLAB_PORT (default 4399)  E2E_MIN_FREE_MB (default 3000)
# exit:  0 completed, valid, no failing folder | 1 completed with failing folders | 2 guard refusal | 3 invalid run
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${E2E_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
LOCK_FILE="${E2E_LOCK_FILE:-/tmp/newsela-e2e-real-stack.lock}"
COLLAB_PORT="${E2E_COLLAB_PORT:-4399}"
MIN_FREE_MB="${E2E_MIN_FREE_MB:-3000}"
ONLY=""; OUT=""; KEEP_TREE=0; DRY_RUN=0; PRINT_FP=0

die() { echo "e2e-real-stack: $*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY="${2:?--only needs a value}"; shift 2 ;;
    --out) OUT="${2:?--out needs a value}"; shift 2 ;;
    --keep-tree) KEEP_TREE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --print-fingerprint) PRINT_FP=1; shift ;;
    *) die "unknown option $1" ;;
  esac
done

# ---------------------------------------------------------------- fingerprint (node reads git; no dependencies)
# Prints {head, branch, dirty, dirty_hash, dirty_files:[{status,path,sha256}]}. Paths under docs/testing/e2e-runs/ (this runner's
# own records and trees) and under $1 (the --out dir) are not part of the candidate, so writing the record cannot change the hash.
fingerprint() {
  node - "$REPO" "${1:-}" <<'NODE'
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const [repo, out] = process.argv.slice(2);
const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", maxBuffer: 1 << 28 });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const skip = ["docs/testing/e2e-runs/"];
if (out) { const rel = path.relative(repo, path.resolve(out)); if (rel && !rel.startsWith("..")) skip.push(rel.replace(/\/?$/, "/")); }
const keep = (p) => !skip.some((s) => p.startsWith(s));
const files = [];
const tok = git("diff", "--name-status", "-z", "HEAD").split("\0").filter((x) => x !== "");
for (let i = 0; i < tok.length; ) {
  const st = tok[i++][0];
  const first = tok[i++];
  const p = st === "R" || st === "C" ? tok[i++] : first;
  files.push({ status: st, path: p });
  if (st === "R") files.push({ status: "D", path: first });
}
for (const p of git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter((x) => x !== "")) files.push({ status: "?", path: p });
const seen = new Map();
for (const f of files) if (keep(f.path)) seen.set(f.path, f);
const list = [...seen.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => ({
  ...f, sha256: f.status === "D" || !existsSync(path.join(repo, f.path)) ? "deleted" : sha(readFileSync(path.join(repo, f.path))),
}));
const dirty_hash = sha(list.map((f) => `${f.status} ${f.path} ${f.sha256}`).sort().join("\n"));
let branch = ""; try { branch = git("rev-parse", "--abbrev-ref", "HEAD").trim(); } catch {}
process.stdout.write(JSON.stringify({ head: git("rev-parse", "HEAD").trim(), branch, dirty: list.length > 0, dirty_hash, dirty_files: list }));
NODE
}

if [ "$PRINT_FP" = 1 ]; then fingerprint "$OUT"; echo; exit 0; fi

# ---------------------------------------------------------------- folder plan
INT_DIR="$REPO/apps/web/e2e/integration"
[ -d "$INT_DIR" ] || die "no $INT_DIR"
mapfile -t ALL_FOLDERS < <(find "$INT_DIR" -mindepth 1 -maxdepth 1 -type d ! -name support -printf '%f\n' | sort -V)
if [ -n "$ONLY" ]; then
  IFS=',' read -r -a FOLDERS <<<"$ONLY"
  for f in "${FOLDERS[@]}"; do
    printf '%s\n' "${ALL_FOLDERS[@]}" | grep -qx -- "$f" || die "unknown folder '$f' (known: ${ALL_FOLDERS[*]})"
  done
else
  FOLDERS=("${ALL_FOLDERS[@]}")
fi

# ---------------------------------------------------------------- guards (nothing is started before they pass)
# port_free N: exit 0 when nothing listens on N (the probe can bind it), 1 when something does.
port_free() { node -e 'const s=require("node:net").createServer();s.once("error",()=>process.exit(1));s.listen(+process.argv[1],"127.0.0.1",()=>s.close(()=>process.exit(0)))' "$1"; }
free_port_in() { for p in $(seq "$1" "$2"); do if port_free "$p"; then echo "$p"; return 0; fi; done; return 1; }
os_port() { node -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

FREE_MB="$(df -Pm "$REPO" | awk 'NR==2{print $4}')"
[ "$FREE_MB" -ge "$MIN_FREE_MB" ] || die "only ${FREE_MB} MB free on the repo filesystem (need ${MIN_FREE_MB})"
if [ "$DRY_RUN" = 0 ]; then
  exec 9>"$LOCK_FILE" || die "cannot open lock file $LOCK_FILE"
  flock -n 9 || die "another real-stack run holds the lock ($LOCK_FILE)"
  port_free "$COLLAB_PORT" || die "collab port $COLLAB_PORT is already listening"
fi

# ---------------------------------------------------------------- run identity
START_JSON="$(fingerprint "$OUT")"
HEAD_SHA="$(node -p 'JSON.parse(process.argv[1]).head' "$START_JSON")"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-$REPO/docs/testing/e2e-runs/${STAMP}-${HEAD_SHA:0:8}}"
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
START_JSON="$(fingerprint "$OUT")"
printf '%s' "$START_JSON" >"$OUT/fingerprint-start.json"
TREE="$OUT/tree"
E2E_PORT_V="$(free_port_in 3200 3399)" || die "no free port in 3200-3399"
SHEETS_PORT="$(os_port)"
STUB_FILE="$OUT/assist-stub.json"
COLLAB_URL="http://127.0.0.1:${COLLAB_PORT}/internal"
SHEETS_URL="http://127.0.0.1:${SHEETS_PORT}"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

folder_env_keys() {
  case "$1" in
    con-17) echo "E2E_COLLAB_PORT E2E_COLLAB_INTERNAL_URL E2E_ASSIST_TIMEOUT_MS E2E_ASSIST_STUB_FILE" ;;
    con-2) echo "E2E_SHEETS_BASE_URL" ;;
    *) echo "" ;;
  esac
}

# The run record is assembled from small files so a crash leaves the latest state on disk.
node -e '
const [out, port, collab_port, collab_url, stub, sheets] = process.argv.slice(1);
require("node:fs").writeFileSync(out + "/env.json", JSON.stringify({ E2E_PORT: port, E2E_COLLAB_PORT: collab_port, E2E_COLLAB_INTERNAL_URL: collab_url, E2E_ASSIST_TIMEOUT_MS: "1500", E2E_ASSIST_STUB_FILE: stub, E2E_SHEETS_BASE_URL: sheets, MODEL_PROVIDER_MODE: "stub" }));
' "$OUT" "$E2E_PORT_V" "$COLLAB_PORT" "$COLLAB_URL" "$STUB_FILE" "$SHEETS_URL"
: >"$OUT/folders.jsonl"; : >"$OUT/plan.jsonl"
for f in "${FOLDERS[@]}"; do
  node -e 'console.log(JSON.stringify({ name: process.argv[1], env_keys: process.argv[2].split(" ").filter(Boolean), planned: true }))' "$f" "$(folder_env_keys "$f")" >>"$OUT/plan.jsonl"
done

# Writes $OUT/run-record.json. args: mode status reasons(comma) [end]
write_record() {
  node - "$OUT" "$1" "$2" "$3" "$STARTED_AT" "${4:-}" <<'NODE'
const fs = require("node:fs");
const [out, mode, status, reasons, started_at, end] = process.argv.slice(2);
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(`${out}/${f}`, "utf8")); } catch { return d; } };
const lines = (f) => { try { return fs.readFileSync(`${out}/${f}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const procs = (f) => { try { return fs.readFileSync(`${out}/${f}`, "utf8").split("\n").filter(Boolean); } catch { return []; } };
const start = rd("fingerprint-start.json", {});
const fin = rd("fingerprint-end.json", null);
const build = rd("build.json", { build_id: null, build_id_sha256: null, build_id_unchanged_at_end: null });
const plan = lines("plan.jsonl");
const done = lines("folders.jsonl");
const folders = plan.map((p) => done.find((d) => d.name === p.name) ?? { name: p.name, env_keys: p.env_keys, command: null, exit_code: null, expected: null, unexpected: null, flaky: null, skipped: null, duration_s: null, log: null });
const env = rd("env.json", {});
const reasonList = reasons ? reasons.split(",") : [];
const rec = {
  schema: 1, mode, started_at, finished_at: end ? new Date().toISOString() : null,
  git: { head: start.head, branch: start.branch, dirty: start.dirty, dirty_hash: start.dirty_hash, dirty_files: start.dirty_files },
  tree_fingerprint_at_end: fin === null ? null : { dirty_hash: fin.dirty_hash },
  node: process.version, playwright: rd("playwright.json", { version: null }).version,
  build, env, folders,
  other_processes_seen: [...new Set([...procs("procs-start.txt"), ...procs("procs-end.txt")])],
  claims: { real_stack_with_stub_model: true, paid_real_model_generation: false, mock_project_run: false },
  validity: { status, reasons: reasonList },
};
fs.writeFileSync(`${out}/run-record.json`, JSON.stringify(rec, null, 2) + "\n");
NODE
}

if [ "$DRY_RUN" = 1 ]; then
  write_record dry-run not_run "" end
  echo "dry-run record: $OUT/run-record.json"
  exit 0
fi

# ---------------------------------------------------------------- the run
CHILD=""
STATE="running"
cleanup() {
  if [ -n "$CHILD" ] && kill -0 "$CHILD" 2>/dev/null; then kill -TERM -- "-$CHILD" 2>/dev/null || true; sleep 2; kill -KILL -- "-$CHILD" 2>/dev/null || true; fi
}
on_signal() { STATE="interrupted"; cleanup; finish; exit 3; }
trap on_signal INT TERM

list_procs() { ps -eo pgid=,args= | grep -E 'playwright|next-server|next start|next build' | grep -v grep | awk -v me="$$" '{ $1=""; print substr($0,2,200) }' | sort -u; }

finish() {
  fingerprint "$OUT" >"$OUT/fingerprint-end.json" 2>/dev/null || true
  list_procs >"$OUT/procs-end.txt" 2>/dev/null || true
  local reasons=()
  [ "$STATE" = "interrupted" ] && reasons+=("interrupted")
  [ -f "$TREE/apps/web/.next/BUILD_ID" ] || reasons+=("build_failed")
  local s e; s="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).dirty_hash' "$OUT/fingerprint-start.json" 2>/dev/null || echo a)"
  e="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).dirty_hash' "$OUT/fingerprint-end.json" 2>/dev/null || echo b)"
  [ "$s" = "$e" ] || reasons+=("tree_changed_during_run")
  if [ -f "$TREE/apps/web/.next/BUILD_ID" ] && [ -f "$OUT/build.json" ]; then
    local now; now="$(sha256sum "$TREE/apps/web/.next/BUILD_ID" | cut -d' ' -f1)"
    node -e 'const f=process.argv[1],n=process.argv[2];const j=JSON.parse(require("fs").readFileSync(f));j.build_id_unchanged_at_end=(j.build_id_sha256===n);require("fs").writeFileSync(f,JSON.stringify(j))' "$OUT/build.json" "$now"
    [ "$now" = "$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1])).build_id_sha256' "$OUT/build.json")" ] || reasons+=("build_id_changed")
  fi
  for f in "${FOLDERS[@]}"; do
    grep -q "\"name\":\"$f\"" "$OUT/folders.jsonl" || reasons+=("folder_not_run:$f")
  done
  local status="valid"
  if [ "${#reasons[@]}" -gt 0 ]; then status="invalid"; elif [ -n "$ONLY" ]; then status="valid_subset"; fi
  local joined=""; [ "${#reasons[@]}" -gt 0 ] && joined="$(IFS=,; echo "${reasons[*]}")"
  write_record run "$status" "$joined" end
  VALIDITY="$status"
  if [ "$KEEP_TREE" = 0 ]; then rm -rf "$TREE"; fi
}

list_procs >"$OUT/procs-start.txt" 2>/dev/null || true
echo '{}' >"$STUB_FILE"
write_record run running ""

mkdir -p "$TREE"
git -C "$REPO" archive HEAD | tar -x -C "$TREE"
# Overlay the uncommitted state so the tree is the candidate, not just HEAD.
node - "$REPO" "$TREE" "$OUT/fingerprint-start.json" <<'NODE'
const fs = require("node:fs"); const path = require("node:path");
const [repo, tree, fpf] = process.argv.slice(2);
for (const f of JSON.parse(fs.readFileSync(fpf, "utf8")).dirty_files) {
  const dst = path.join(tree, f.path);
  if (f.status === "D") { fs.rmSync(dst, { force: true }); continue; }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(repo, f.path), dst);
}
NODE
"$REPO/scripts/link-node-modules.sh" "$TREE" >/dev/null
node -e 'try{console.log(JSON.stringify({version:require(process.argv[1]+"/node_modules/@playwright/test/package.json").version}))}catch{console.log(JSON.stringify({version:null}))}' "$TREE" >"$OUT/playwright.json"

FIRST=1
FAILED=0
for f in "${FOLDERS[@]}"; do
  # Trailing slash: a Playwright path filter is a substring match, so "integration/con-1" would also run con-10..con-19.
  cmd=(npx playwright test -c playwright.real.config.ts "integration/$f/" --reporter=list,json)
  # env(1) takes its -u options only before the first NAME=VALUE, so the unsets come first.
  envs=(-u ANTHROPIC_API_KEY -u OPENROUTER_API_KEY)
  if [ "$FIRST" = 1 ]; then envs+=(-u E2E_SKIP_BUILD "E2E_PORT=$E2E_PORT_V"); else envs+=("E2E_PORT=$E2E_PORT_V" "E2E_SKIP_BUILD=1"); fi
  envs+=("PLAYWRIGHT_JSON_OUTPUT_NAME=$OUT/$f.json")
  case "$f" in
    con-17) envs+=("E2E_COLLAB_PORT=$COLLAB_PORT" "E2E_COLLAB_INTERNAL_URL=$COLLAB_URL" "E2E_ASSIST_TIMEOUT_MS=1500" "E2E_ASSIST_STUB_FILE=$STUB_FILE") ;;
    con-2) envs+=("E2E_SHEETS_BASE_URL=$SHEETS_URL") ;;
  esac
  t0=$(date +%s)
  set +e
  (cd "$TREE/apps/web" && exec setsid timeout 900 env "${envs[@]}" "${cmd[@]}" >"$OUT/$f.log" 2>&1) &
  CHILD=$!
  wait "$CHILD"; rc=$?
  set -e
  CHILD=""
  t1=$(date +%s)
  if [ "$FIRST" = 1 ] && [ -f "$TREE/apps/web/.next/BUILD_ID" ]; then
    node -e 'const fs=require("fs"),c=require("crypto");const id=fs.readFileSync(process.argv[1],"utf8");fs.writeFileSync(process.argv[2],JSON.stringify({build_id:id.trim(),build_id_sha256:c.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex"),build_id_unchanged_at_end:null}))' "$TREE/apps/web/.next/BUILD_ID" "$OUT/build.json"
  fi
  FIRST=0
  [ "$rc" -eq 0 ] || FAILED=$((FAILED + 1))
  node -e '
const fs=require("fs");const [name,keys,cmd,rc,dur,json,log]=process.argv.slice(1);
let s={};try{s=JSON.parse(fs.readFileSync(json,"utf8")).stats||{}}catch{}
fs.appendFileSync(process.argv[8],JSON.stringify({name,env_keys:keys.split(" ").filter(Boolean),command:cmd,exit_code:+rc,expected:s.expected??null,unexpected:s.unexpected??null,flaky:s.flaky??null,skipped:s.skipped??null,duration_s:+dur,log})+"\n");
' "$f" "$(folder_env_keys "$f")" "${cmd[*]}" "$rc" "$((t1 - t0))" "$OUT/$f.json" "$f.log" "$OUT/folders.jsonl"
  write_record run running ""
done

VALIDITY=""
finish
echo "run record: $OUT/run-record.json  (validity: $VALIDITY, failing folders: $FAILED)"
case "$VALIDITY" in valid|valid_subset) [ "$FAILED" -eq 0 ] && exit 0 || exit 1 ;; *) exit 3 ;; esac
