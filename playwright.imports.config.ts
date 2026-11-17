import { defineConfig } from "@playwright/test";
import unified from "./playwright.unified.config";

export default defineConfig(unified, {
  use: {
    ...unified.use,
    channel: process.env.MAZI_CHROME_CHANNEL || undefined,
  },
  testMatch: ["imports-workspace.spec.ts"],
  outputDir: "test-results/import-workspace",
  reporter: "list",
});
