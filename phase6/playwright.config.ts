import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8004",
    channel: process.env.MAZI_CHROME_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `${process.env.MAZI_PYTHON || "python3"} -m phase6.tests.browser_server`,
    cwd: "..",
    url: "http://127.0.0.1:8004/ask",
    reuseExistingServer: false,
  },
});
