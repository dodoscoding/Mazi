import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const [port, dir] = process.argv.slice(2);
const { token } = JSON.parse(readFileSync(`${dir}/session.json`, "utf8"));
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await context.addCookies([{ name: "mazi_session", value: token, url: `http://127.0.0.1:${port}` }]);
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/?scene=off`);
  await page.waitForTimeout(3000);
  console.log(JSON.stringify(await page.evaluate(() => Object.fromEntries(
    [".atlas-home", ".atlas-readout", ".atlas-timebar", ".replay", ".atlas-sheet", ".place-tray"].map((s) => {
      const r = document.querySelector(s)?.getBoundingClientRect();
      return [s, r && [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]];
    })))));
} finally { await browser.close(); }
