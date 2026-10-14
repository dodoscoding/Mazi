import { defineConfig, devices } from "@playwright/test";
const firefoxLaunchOptions = process.env.MAZI_FIREFOX_EXECUTABLE
  ? { executablePath: process.env.MAZI_FIREFOX_EXECUTABLE }
  : {};
export default defineConfig({
  testDir: "./tests",
  testMatch: ["journey.spec.ts", "resilience.spec.ts", "evidence.spec.ts"],
  fullyParallel: true,
  timeout: 30000,
  expect: { timeout: 7000 },
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1024 },
      },
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: firefoxLaunchOptions,
        viewport: { width: 1440, height: 1024 },
      },
    },
    {
      name: "firefox-phone",
      use: {
        browserName: "firefox",
        launchOptions: firefoxLaunchOptions,
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
