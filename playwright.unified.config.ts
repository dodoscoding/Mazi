import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.MAZI_UNIFIED_PORT || 8017);
export default defineConfig({
  testDir: "./tests",
  testMatch: ["unified.spec.ts", "entry.spec.ts", "features-redesign.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: "work/poteto/unified-app/browser-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "work/poteto/unified-app/browser-results.json" }],
  ],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
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
    command: `npm run build && MAZI_IMPORT_PORT=${port} .venv/bin/python -m tests.browser.memories_server`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
