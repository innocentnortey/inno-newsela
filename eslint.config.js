import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

const PACKAGES = ["schema", "editor-schema", "core", "ydoc", "db", "llm", "prompts", "config", "obs"];
const ADAPTERS = ["db", "llm", "ydoc", "prompts"];
const APPS = ["app-web", "app-worker", "app-collab"];
const TOOLS = ["evals", "load", "ops"];
const ALL = [...PACKAGES, ...APPS, ...TOOLS];

const except = (...keep) => ALL.filter((t) => !keep.includes(t));
const forbid = (from, allowed) => [
  {
    from: { element: { type: from } },
    disallow: { to: { element: { types: { anyOf: except(...allowed) } } } },
  },
  forbid_ls(from, allowed),
];
// Workspace imports (`@ls/<name>/<file>`) resolve through node_modules, so the plugin sees them as
// external modules: they are matched by package name. Relative imports are matched by element type.
const ls_name = (type) => `@ls/${type.replace(/^app-/, "")}`;
const forbid_ls = (from, allowed) => ({
  from: { element: { type: from } },
  disallow: { to: { module: { source: except(...allowed).map((t) => `${ls_name(t)}{,/**}`) } } },
});
const forbid_external = (from, sources) => ({
  from: { element: { type: from } },
  disallow: { to: { module: { source: sources } } },
});

export default [
  {
    ignores: ["**/node_modules/**", "**/.next/**", "docs/**", "ops/vps-run/**", "evals/local/**", "**/dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.ts", "evals/**/*.ts", "load/**/*.ts", "ops/**/*.ts"],
    plugins: { boundaries },
    settings: {
        "boundaries/elements": [
        ...PACKAGES.map((name) => ({ type: name, pattern: `packages/${name}/**` })),
        ...["web", "worker", "collab"].map((name) => ({ type: `app-${name}`, pattern: `apps/${name}/**` })),
        ...TOOLS.map((name) => ({ type: name, pattern: `${name}/**` })),
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          // Without this the rule skips external and builtin imports (pg, node:http, @ls/*).
          checkAllOrigins: true,
          policies: [
            // core: pure domain. Only schema, editor-schema and itself.
            ...forbid("core", ["schema", "editor-schema", "core", "config"]),
            forbid_external("core", [
              "pg",
              "@anthropic-ai/sdk",
              "yjs",
              "y-prosemirror",
              "y-protocols",
              "@hocuspocus/*",
              "next",
              "next/**",
              "node:http",
              "node:https",
              "http",
              "https",
            ]),
            ...forbid("schema", ["schema"]),
            ...forbid("editor-schema", ["editor-schema"]),
            ...forbid("config", ["config"]),
            ...forbid("obs", ["obs", "config"]),
            // adapters: the pure packages plus config and obs; not each other, not apps.
            // db may also use ydoc (seed_initial builds the first Y.Doc state; NL-36).
            ...ADAPTERS.flatMap((a) => forbid(a, [a, "core", "schema", "editor-schema", "config", "obs", ...(a === "db" ? ["ydoc"] : [])])),
            // apps: any package, no other app.
            ...forbid("app-web", [...PACKAGES, "app-web"]),
            ...forbid("app-worker", [...PACKAGES, "app-worker"]),
            ...forbid("app-collab", [...PACKAGES, "app-collab"]),
            // tools: any package and the worker/collab runtimes, never web.
            ...TOOLS.flatMap((t) => forbid(t, [...PACKAGES, "app-worker", "app-collab", t])),
          ],
        },
      ],
    },
  },
  {
    files: ["packages/db/src/testing/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "R-58: no raw HTML injection" },
        { selector: "AssignmentExpression[left.property.name='innerHTML']", message: "R-58: no raw HTML injection" },
      ],
    },
  },
];
