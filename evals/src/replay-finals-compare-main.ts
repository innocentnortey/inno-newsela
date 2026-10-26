// `npx tsx evals/src/replay-finals-compare-main.ts --which final a.json b.json ...` prints the markdown comparison of replay outputs, in the order given.
import type { Which } from "./replay-finals.ts";
import { load_boundary, render_comparison } from "./replay-finals-compare.ts";

const argv = process.argv.slice(2);
const wi = argv.indexOf("--which");
const which = (wi < 0 ? "final" : argv[wi + 1]) as Which;
const files = argv.filter((_, i) => wi < 0 || (i !== wi && i !== wi + 1));
if (files.length === 0) { console.error("usage: --which <original|effective|last_repair|final> a.json b.json ..."); process.exit(2); }
const bs = files.map(load_boundary);
if (new Set(bs.map((b) => b.review_context)).size > 1) { console.error("refusing: the files use different review contexts"); process.exit(2); }
process.stdout.write(render_comparison(bs, which));
