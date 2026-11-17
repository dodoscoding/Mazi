import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "parallel.spec.ts",
  timeout: 30000,
  use: {
    channel: process.env.MAZI_TEST_CHROME === "1" ? "chrome" : undefined,
    baseURL: "http://127.0.0.1:5179",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1024 },
      },
    },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5179",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: false,
  },
});
