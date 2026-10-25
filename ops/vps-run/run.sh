#!/usr/bin/env bash
# Start (or continue) the Newsela two-phase launcher inside tmux, so it survives the SSH connection closing.
# Usage: bash ops/vps-run/run.sh            (from the repo root or anywhere)
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SESSION=newsela-run
export PATH="$HOME/.local/bin:$PATH"
if tmux has-session -t "$SESSION" 2>/dev/null; then
  if pgrep -f "python3 ops/vps-run/launcher.py run" >/dev/null; then
    echo "The launcher is already running in tmux session '$SESSION'."
    echo "Attach: tmux attach -t $SESSION   (detach again with Ctrl-b then d) · Session: claude attach newsela-phase-b"
    exit 0
  fi
  tmux kill-session -t "$SESSION"     # only the idle shell left after a finished launcher
fi
python3 "$ROOT/ops/vps-run/launcher.py" preflight --phase A >/dev/null 2>&1 || true
tmux new-session -d -s "$SESSION" -c "$ROOT" \
  "export PATH=\"$HOME/.local/bin:\$PATH\"; python3 ops/vps-run/launcher.py run 2>&1 | tee -a ops/vps-run/logs/launcher-console.log; echo; echo 'Launcher finished. Status: python3 ops/vps-run/launcher.py status'; exec bash"
echo "Started. Session: claude attach newsela-phase-b (once it appears in claude agents) · Launcher: tmux attach -t $SESSION · Status: python3 $ROOT/ops/vps-run/launcher.py status"
