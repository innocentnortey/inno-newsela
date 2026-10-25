// NL-95: run with `npx tsx` (the repo packages are ESM; Playwright loads e2e as CJS). Prints the hash of the locked prompt layer on disk.
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";

process.stdout.write(locked_hash(LOCKED_DIR));
