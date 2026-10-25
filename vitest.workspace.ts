export const projects = [
  { test: { name: "platform", environment: "node", hookTimeout: 60000, include: ["tests/platform/**/*.test.ts"] } },
  {
    test: {
      name: "workspaces",
      hookTimeout: 60000, // test-database creation (migrate) takes ~9 s while other agents share the Postgres
      environment: "node",
      exclude: ["**/node_modules/**"],
      include: [
        "packages/*/src/**/*.test.ts",
        "packages/*/tests/**/*.test.ts",
        "apps/worker/src/**/*.test.ts",
        "apps/worker/test/**/*.test.ts",
        "apps/collab/src/**/*.test.ts",
        "evals/**/*.test.ts",
        "load/**/*.test.ts",
        "ops/*.test.ts",
        "ops/src/**/*.test.ts",
      ],
    },
  },
  "apps/web",
];
