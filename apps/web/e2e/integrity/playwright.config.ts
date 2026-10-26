// NL-125: real-stack Playwright config for the S5 integrity suite (WF-43). Copy of playwright.real.config.ts with its own
// test folder, output folders and port (E2E_PORT, default 3160). trace/screenshot/video stay off: a trace records typed passwords.
import { defineConfig } from "@playwright/test";

const PORT = process.env["E2E_PORT"] ?? "3160";

export default defineConfig({
  testDir: ".",
  outputDir: "../../test-results/integrity-out",
  globalSetup: "../integration/support/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"], ["json", { outputFile: "../../test-results/integrity/report.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    screenshot: "off",
    video: "off",
    browserName: "chromium",
  },
});
