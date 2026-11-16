import { defineConfig } from "@playwright/test";
import photos from "./playwright.photos.config";

export default defineConfig({
  ...photos,
  testMatch: ["annual-recap.spec.ts"],
  outputDir: "test-results/annual-recap",
  webServer: {
    ...photos.webServer,
    env: { MAZI_PHOTOS_FIXTURE: "1", MAZI_RECAP_FIXTURE: "1" },
  },
});
