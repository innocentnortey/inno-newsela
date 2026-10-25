// NL-108 (WF-46): KickoffData -> one standalone HTML string. Pure; no fs, no script, no external reference.
import type { KickoffData } from "./collect.ts";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `
:root{color-scheme:light dark;--bg:#F4F5F7;--surface:#FFFFFF;--line:#E2E5EA;--text:#14171C;--muted:#4A5260;--accent:#1F4FD8;--soft:#EAF0FE}
@media (prefers-color-scheme:dark){:root{--bg:#0F1115;--surface:#171A20;--line:#2A2F38;--text:#ECEEF2;--muted:#A9B0BC;--accent:#8AA9FF;--soft:#1C2744}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.8rem;margin:0 0 4px}h2{font-size:1.3rem;margin:40px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}h3{font-size:1.05rem;margin:0 0 6px}
p,li{max-width:70ch}.muted{color:var(--muted)}
nav a{color:var(--accent);margin-right:14px}
section.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:14px 0}
pre{background:var(--soft);border:1px solid var(--line);border-radius:6px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:13px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace;margin:8px 0 0}
code{font:.9em ui-monospace,"SF Mono",Menlo,Consolas,monospace}
table{border-collapse:collapse;width:100%;background:var(--surface);font-size:.92rem}
th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--soft)}
.tablewrap{overflow-x:auto}
svg{max-width:100%;height:auto}svg rect{fill:var(--surface);stroke:var(--accent);stroke-width:1.5}svg text{fill:var(--text);font:13px system-ui,sans-serif}svg .arrow{stroke:var(--muted);fill:none;stroke-width:1.5}svg polygon{fill:var(--muted)}
footer{margin-top:48px;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:.9rem}
`;

function flow(d: KickoffData): string {
  const w = 150, h = 56, gap = 34, pad = 10;
  const total = pad * 2 + d.nodes.length * w + (d.nodes.length - 1) * gap;
  const parts = d.nodes.map((n, i) => {
    const x = pad + i * (w + gap);
    const arrow =
      i === 0
        ? ""
        : `<line class="arrow" x1="${x - gap + 2}" y1="${pad + h / 2}" x2="${x - 8}" y2="${pad + h / 2}"/><polygon points="${x - 2},${pad + h / 2} ${x - 9},${pad + h / 2 - 5} ${x - 9},${pad + h / 2 + 5}"/>`;
    return `${arrow}<rect x="${x}" y="${pad}" width="${w}" height="${h}" rx="6"/><text x="${x + w / 2}" y="${pad + 24}" text-anchor="middle">${esc(n.name)}</text><text x="${x + w / 2}" y="${pad + 42}" text-anchor="middle">${esc(n.cls)}</text>`;
  });
  return `<svg role="img" aria-label="Pipeline nodes in order" viewBox="0 0 ${total} ${h + pad * 2}" width="${total}" height="${h + pad * 2}">${parts.join("")}</svg>`;
}

function rows<T>(items: T[], cells: (t: T) => string[]): string {
  return items.map((t) => `<tr>${cells(t).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
}

export function render_kickoff(d: KickoffData): string {
  const layers = d.layers
    .map(
      (l) =>
        `<section class="card" id="layer-${esc(l.file)}"><h3>${esc(l.file)}</h3><p class="muted">${esc(l.kind)} layer, task: ${esc(l.task)} · version <code>${esc(l.version)}</code> · sha256 <code>${esc(l.sha256)}</code></p><pre>${esc(l.text)}</pre></section>`,
    )
    .join("\n");
  const settled = rows(Object.entries(d.settled), ([k, v]) => [`<code>${esc(k)}</code>`, esc(v)]);
  const ft = d.ft.length
    ? `<ul>${d.ft.map((f) => `<li><strong>${esc(f.id)}</strong> ${esc(f.title)} <span class="muted">(${esc(f.file)})</span></li>`).join("")}</ul>`
    : `<p>FT-N failure types: none yet (they come from the error analysis in <code>docs/testing/error-analysis/</code>).</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Experiment kickoff</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>Experiment kickoff</h1>
<p class="muted">Generated from the code and tracked docs, so it cannot drift from what runs.</p>
<nav><a href="#flow">Flow</a><a href="#prompts">Prompts</a><a href="#approach">Chosen approach</a><a href="#failures">Failure types</a><a href="#footer">Footer</a></nav>

<h2 id="flow">Flow</h2>
<div class="tablewrap">${flow(d)}</div>
<h3>route_after_checks decision table</h3>
<table><thead><tr><th>First matching row wins</th></tr></thead><tbody>${rows(d.route_table, (r) => [`<code>${esc(r)}</code>`])}</tbody></table>

<h2 id="prompts">Prompts</h2>
<p>The version of a layer is the first 12 characters of its sha256. The folder hash <code>${esc(d.locked_hash)}</code> is what <code>prompt_version.locked_hash</code> stores.</p>
<p>Guidance layer v1 as seeded: ${d.guidance_v1 === "" ? "empty (renders as <code>(none)</code>)" : `<code>${esc(d.guidance_v1)}</code>`}.</p>
<p>Renderers (<code>packages/prompts/src/render.ts</code>): ${d.renderers.map((r) => `<code>${esc(r)}</code>`).join(", ") || "none found"}.</p>
${layers}

<h2 id="approach">Chosen approach</h2>
<h3>HP-1 card</h3>
<pre>${esc(d.hp1_card)}</pre>
<h3>Settled values (SP-1)</h3>
<div class="tablewrap"><table><thead><tr><th>Setting</th><th>Value</th></tr></thead><tbody>${settled}</tbody></table></div>

<h2 id="failures">Failure types</h2>
<div class="tablewrap"><table><thead><tr><th>Id</th><th>Category</th><th>What it means</th><th>Fix lives in</th></tr></thead><tbody>${rows(d.fc, (f) => [esc(f.id), esc(f.title), esc(f.means), esc(f.fix_lives_in)])}</tbody></table></div>
<h3>Failure types found so far</h3>
${ft}

<footer id="footer">
<p>Git SHA <code>${esc(d.footer.git_sha)}</code> · generator version ${esc(d.footer.generator_version)} · generated ${esc(d.footer.generated_at)} · locked hash <code>${esc(d.locked_hash)}</code></p>
</footer>
</main>
</body>
</html>
`;
}
