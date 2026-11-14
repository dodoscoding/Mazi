import { defineConfig } from "@playwright/test";
import unified from "./playwright.unified.config";

export default defineConfig({
  ...unified,
  testMatch: ["photos.spec.ts"],
  outputDir: "work/poteto/app-simplification/photos-results",
  reporter: [["list"]],
  webServer: {
    ...unified.webServer,
    command: `MAZI_PHOTOS_FIXTURE=1 ${unified.webServer!.command}`,
  },
});
