# newsela-web

Standalone Next.js app for Newsela Lesson Studio (FW-1: scaffold, design tokens, typography).

## Scripts

- `npm run dev` / `build` / `start`: Next.js
- `npm run lint`, `npm run typecheck`, `npm test` (Vitest)
- `npm run tokens`: regenerate `src/styles/tokens.css`

`tokens.css` is generated: edit `docs/design/design.md`, then `npm run tokens`. A test fails if the file drifts from the design doc or if any contrast pair drops below 4.5:1 (text) or 3:1 (UI).

## Version deviations from "latest at least 14 days old"

- `typescript@6.0.3` (not 7): `typescript-eslint` peers `typescript <6.1.0`.
- `eslint@9.39.5` (not 10): the plugins in `eslint-config-next` peer `eslint <=9`.
- `@types/node@24` matches the Node 24 runtime.
- `vite@8.3.4` is listed because `@vitejs/plugin-react@6` peers `vite ^8`.
- `next@16.4.0` prints a security-advisory notice at build; upgrading is left to the integrator.

NL-06 adopts this package into the workspace and removes this lockfile.
