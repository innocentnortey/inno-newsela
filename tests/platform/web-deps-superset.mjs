// NL-06 AC-1: apps/web/package.json keeps every FW-1 dependency (from b5aa505).
// Baseline = FW-1's original apps/web/package.json (git show b5aa505:apps/web/package.json).
// Allowlist: exactly vitest 5.0.3 -> 5.0.5 and vite 8.3.4 -> 8.3.5. Why: one vitest copy in the workspace
// (dual copies broke jest-dom matcher types). Innocent's PD-32 standing authorization;
// orchestrator-approved deviation 2026-10-25.
import { readFileSync } from "node:fs";
const baseline = {
  dependencies: {
    "@fontsource-variable/inter": "5.3.0", "@radix-ui/react-dialog": "1.2.0", "@radix-ui/react-tabs": "1.1.22",
    clsx: "2.1.1", next: "16.4.3", react: "19.3.0", "react-dom": "19.3.0", "tailwind-merge": "3.7.0",
  },
  devDependencies: {
    "@tailwindcss/postcss": "4.3.3", "@testing-library/dom": "10.4.2", "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3", "@testing-library/user-event": "14.6.7", "@types/node": "24.19.2",
    "@types/react": "19.3.0", "@types/react-dom": "19.3.0", "@vitejs/plugin-react": "6.1.2", eslint: "9.39.5",
    "eslint-config-next": "16.4.3", jsdom: "30.1.2", postcss: "8.5.29", tailwindcss: "4.3.3", typescript: "6.0.3",
    vite: "8.3.4", vitest: "5.0.3",
  },
};
const pkg = JSON.parse(readFileSync(new URL("../../apps/web/package.json", import.meta.url), "utf8"));
const allowed = { vite: "8.3.5", vitest: "5.0.5" };
let n = 0;
for (const [section, deps] of Object.entries(baseline)) {
  for (const [name, version] of Object.entries(deps)) {
    n++;
    const want = section === "devDependencies" && name in allowed ? allowed[name] : version;
    if (pkg[section]?.[name] !== want) {
      console.error(`superset FAIL: ${section} ${name} expected ${want}, got ${pkg[section]?.[name]}`);
      process.exit(1);
    }
  }
}
console.log(`superset OK (${n} deps)`);
