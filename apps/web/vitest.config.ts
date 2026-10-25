import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

const common = {
  plugins: [react()],
  resolve: { alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/server-only-stub.ts"),
    } },
};

// Server code (src/server, app/api, middleware) runs under Node, so it is tested under Node (NL-25: the frozen
// passwords test reads its own source through a file URL, which jsdom's URL class breaks). UI tests stay on jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        ...common,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}", "app/**/*.test.tsx"],
          setupFiles: ["./tests/unit/tokens/setup.ts"],
          globals: false,
        },
      },
      {
        ...common,
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts", "app/**/*.test.ts", "middleware.test.ts"],
          setupFiles: ["./tests/unit/tokens/setup.ts"],
          globals: false,
        },
      },
    ],
  },
});
