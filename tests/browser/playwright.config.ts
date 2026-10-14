import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const domains = [
  "imports",
  "archive",
  "sources",
  "discovery",
  "answers",
  "memories",
];
const portBase = Number(process.env.MAZI_DOMAIN_PORT_BASE || 18020);
export default defineConfig({
  testDir: ".",
  outputDir: process.env.MAZI_BROWSER_RESULTS_DIR || "/tmp/mazi-domain-results",
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    channel: process.env.MAZI_CHROME_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  projects: domains.flatMap((domain, index) =>
    ["desktop", "phone"].map((screen) => ({
      name: `${domain}-${screen}`,
      testMatch:
        domain === "discovery"
          ? /discovery(-learned)?\.spec\.ts/
          : `${domain}.spec.ts`,
      use: {
        ...(screen === "desktop"
          ? devices["Desktop Chrome"]
          : devices["Pixel 7"]),
        baseURL: `http://127.0.0.1:${portBase + index}`,
      },
    })),
  ),
  webServer: domains.map((domain, index) => ({
    command: `MAZI_IMPORT_PORT=${portBase + index} ${process.env.MAZI_PYTHON || "python3"} -m tests.browser.${domain}_server`,
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    url: `http://127.0.0.1:${portBase + index}/`,
    reuseExistingServer: false,
  })),
});
