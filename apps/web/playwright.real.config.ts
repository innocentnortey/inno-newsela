// NL-90: real-stack Playwright config (built Next app + test Postgres, started in global-setup). Port from E2E_PORT (3122 here; 3121 default).
// trace/screenshot/video are off on purpose: a trace would record the typed password (NL-90 plan, Risks 3).
import { defineConfig } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "3121";

export default defineConfig({
  testDir: "./e2e/integration",
  outputDir: "./test-results/integration",
  globalSetup: "./e2e/integration/support/global-setup.ts",
  snapshotPathTemplate: "e2e/__screenshots__/integration/con-1/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "off",
    video: "off",
    browserName: "chromium",
  },
});
