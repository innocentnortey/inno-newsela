#!/usr/bin/env bash
# Give a git worktree a node_modules without a second install: hard-link copy of the main checkout's
# (near-zero extra disk; workspace links under @ls/* are relative, so they point at the worktree's own packages).
# usage: scripts/link-node-modules.sh <worktree-dir>     (run from anywhere)
set -euo pipefail
MAIN="$(cd "$(dirname "$0")/.." && pwd)"
WT="$(cd "${1:?usage: link-node-modules.sh <worktree-dir>}" && pwd)"
[ "$WT" != "$MAIN" ] || { echo "refusing: target is the main checkout" >&2; exit 2; }
for rel in node_modules apps/*/node_modules packages/*/node_modules evals/node_modules load/node_modules ops/node_modules; do
  for src in $MAIN/$rel; do
    [ -d "$src" ] || continue
    r="${src#$MAIN/}"; dst="$WT/$r"
    [ -e "$dst" ] && continue
    mkdir -p "$(dirname "$dst")"
    cp -al "$src" "$dst"
  done
done
echo "linked node_modules into $WT"
