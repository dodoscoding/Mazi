import { defineConfig } from "@playwright/test";
import unified from "./playwright.unified.config";

export default defineConfig(unified, {
  testMatch: ["imports-workspace.spec.ts"],
  outputDir: "test-results/import-workspace",
  reporter: "list",
});
