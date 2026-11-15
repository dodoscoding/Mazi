import { defineConfig } from "@playwright/test";
import unified from "./playwright.unified.config";

export default defineConfig({
  ...unified,
  testMatch: ["add-queues.spec.ts"],
  outputDir: "work/poteto/app-simplification/issue-154-browser-results",
  reporter: [["list"]],
  webServer: {
    ...unified.webServer,
    command: `npm run build && MAZI_IMPORT_PORT=${Number(process.env.MAZI_UNIFIED_PORT || 8017)} .venv/bin/python -m tests.browser.archive_server`,
  },
});
