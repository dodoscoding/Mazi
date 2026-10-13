import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8002", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `${process.env.MAZI_PYTHON || "python3"} -m phase2.tests.browser_server`,
    cwd: "..",
    url: "http://127.0.0.1:8002",
    reuseExistingServer: false,
  },
});
