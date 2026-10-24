// node drive.mjs <port> <dataDir>
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
const [port, dir] = process.argv.slice(2);
const out = new URL(".", import.meta.url).pathname;
const { token, memory } = JSON.parse(readFileSync(`${dir}/session.json`, "utf8"));
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "mazi_session", value: token, url: base }]);
  const page = await context.newPage();
  const logs = [];
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()} ${r.url()}`));
  await page.goto(`${base}/`);
  await page.waitForTimeout(5000);
  report.home = await page.evaluate(() =>
    [...document.querySelectorAll(".index-meta, .readout-summary, .readout-year")].map((e) => e.textContent.trim()),
  );
  await page.screenshot({ path: `${out}/home.png` });
  await page.goto(`${base}/#/timeline`);
  await page.waitForTimeout(3000);
  report.timeline = await page.evaluate(() => ({
    subtitle: document.querySelector(".browse-sub")?.textContent,
    rows: [...document.querySelectorAll("[data-memory-id]")].map((e) => ({
      year: e.closest("li[data-year]")?.dataset.year,
      text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 140),
    })),
    dates: [...document.querySelectorAll(".tl-date")].map((e) => e.textContent.trim()),
  }));
  await page.screenshot({ path: `${out}/timeline.png`, fullPage: true });
  await page.goto(`${base}/#/memory/${memory}`);
  await page.waitForTimeout(3000);
  report.memory = await page.evaluate(() => document.querySelector("main")?.innerText.replace(/\n+/g, " | ").slice(0, 700));
  await page.screenshot({ path: `${out}/memory.png` });
  report.logs = logs;
} finally {
  await browser.close();
}
writeFileSync(`${out}/drive-output.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
