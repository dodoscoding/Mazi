import { defineConfig } from "@playwright/test";
import unified from "./playwright.unified.config";
const port = Number(process.env.MAZI_UNIFIED_PORT || 8156);
export default defineConfig({
  ...unified,
  testMatch: ["conversations.spec.ts"],
  outputDir: "test-results/conversations",
  reporter: "list",
  use: { ...unified.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npm run build && MAZI_IMPORT_PORT=${port} .venv/bin/python -m tests.browser.conversations_server`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
