import { defineConfig } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3100";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: [
    {
      command: `npm run dev -- -p ${PORT}`,
      url: `http://localhost:${PORT}/gallery`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Prism ignores the OpenAPI `/api` server prefix, so the mock client calls it without one (NL-24 plan, Risks 3).
      env: {
        NEXT_PUBLIC_API_BASE: "http://127.0.0.1:4010",
        NEXT_PUBLIC_API_PREFIX: "",
        NEXT_PUBLIC_DEMO_ACCOUNTS: "1",
        NEXT_PUBLIC_COLLAB_URL: "ws://localhost:4020",
      },
    },
    {
      // Prism answers GET /session with 401 (cookie security scheme); Playwright treats 401 as "up".
      command: "npm run mock:api",
      url: "http://127.0.0.1:4010/session",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run mock:collab",
      url: "http://127.0.0.1:4020/__mock/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: "chromium", testMatch: "gallery/**/*.spec.ts", use: { browserName: "chromium" } },
    { name: "mock", testMatch: "{frame,sign-in,units-home,upload-outline,validation-report,start-run,progress,board,workspace-read,workspace-actions,workspace-editor,approval,unit-plan}/**/*.spec.ts", use: { browserName: "chromium" } },
  ],
});
