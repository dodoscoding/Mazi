// Captures PR 1 review screenshots from a running sample server.
// Usage: node work/poteto/luminous-night/evidence/pr1/capture.mjs http://127.0.0.1:5173
import { chromium, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || "http://127.0.0.1:5173";
const out = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const shots = [
  { name: "home-desktop", viewport: { width: 1440, height: 900 } },
  { name: "home-phone", viewport: { width: 390, height: 844 }, phone: true },
];
for (const theme of ["night", "day"]) {
  for (const shot of shots) {
    const context = await browser.newContext({
      ...(shot.phone ? devices["iPhone 13"] : {}),
      viewport: shot.viewport,
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (value) => localStorage.setItem("mazi.theme", value),
      theme,
    );
    const page = await context.newPage();
    await page.request.post(`${base}/api/entry`, {
      data: { name: "Sample", code: "synthetic-shared-code" },
    });
    await page.goto(`${base}/?demo=1`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".featured .photo-frame.is-loaded").waitFor();
    await page.getByText("Drawing your atlas…").waitFor({ state: "detached" });
    await page.screenshot({ path: `${out}/${shot.name}-${theme}.png` });
    if (shot.phone) {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("dialog", { name: "More" }).waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/more-sheet-phone-${theme}.png` });
    } else {
      await page.getByRole("button", { name: "Archive tools" }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${out}/archive-tools-desktop-${theme}.png`,
      });
    }
    await context.close();
  }
}
await browser.close();
