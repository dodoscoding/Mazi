import { defineConfig } from "@playwright/test";
import unified from "./playwright.unified.config";

export default defineConfig({
  ...unified,
  testMatch: [
    "photos.spec.ts",
    "photos-search.spec.ts",
    "ai-retirement.spec.ts",
  ],
  outputDir: "test-results/photos",
  reporter: [["list"]],
  webServer: {
    ...unified.webServer,
    env: { MAZI_PHOTOS_FIXTURE: "1" },
  },
});
