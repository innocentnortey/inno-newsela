"""Test helpers for the prd-interview suite (stdlib only)."""
import os
import shutil
import subprocess
import tempfile

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(SKILL_ROOT, "scripts")
CHECKLIST_PY = os.path.join(SCRIPTS_DIR, "checklist.py")
CHECKLISTS_DIR = os.path.join(SKILL_ROOT, "checklists")


def run(cmd, cwd=None, check=False, env=None):
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, env=full_env)


class TempDir:
    """A throwaway directory as a context manager."""

    def __enter__(self):
        self.path = tempfile.mkdtemp(prefix="prd-test-")
        return self

    def __exit__(self, *exc):
        shutil.rmtree(self.path, ignore_errors=True)

    def write(self, relpath, content):
        full = os.path.join(self.path, relpath)
        os.makedirs(os.path.dirname(full) or self.path, exist_ok=True)
        with open(full, "w") as f:
            f.write(content)
        return full
