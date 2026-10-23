// node drive.mjs <port> <dataDir> <label> [viewport w h]
import { chromium } from "/Users/altanesmer/Desktop/Ales/Mazi-wt/investigate-20261023/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const [port, dir, label, w = "1440", h = "1024"] = process.argv.slice(2);
const out = new URL(".", import.meta.url).pathname;
const { token } = JSON.parse(readFileSync(`${dir}/session.json`, "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: +w, height: +h } });
await context.addCookies([{ name: "mazi_session", value: token, url: `http://127.0.0.1:${port}` }]);
const page = await context.newPage();
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("response", (r) => r.status() >= 400 && logs.push(`HTTP ${r.status()} ${r.url()}`));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(6000);
const state = async () =>
  page.evaluate(() => {
    const stage = document.querySelector(".atlas-stage");
    const canvas = document.querySelector(".globe-canvas canvas");
    const gl = canvas && (canvas.getContext("webgl2") || canvas.getContext("webgl"));
    return {
      hash: location.hash,
      hidden: document.hidden,
      h1: [...document.querySelectorAll("h1,h2")].map((e) => e.textContent).slice(0, 4),
      stage: stage && { flat: stage.dataset.flat, ready: stage.dataset.ready, rect: stage.getBoundingClientRect().toJSON() },
      canvas: canvas && { w: canvas.width, h: canvas.height, lost: gl ? gl.isContextLost() : "noctx" },
      loading: document.querySelector(".scene-loading")?.textContent,
      flatNote: document.querySelector(".flat-note")?.textContent?.slice(0, 80),
      flatNodes: document.querySelectorAll(".flat-node").length,
      flatLand: !!document.querySelector(".flat-land"),
      globeLabels: document.querySelectorAll(".globe-root [data-place], .globe-label, .globe-overlay *").length,
      readout: document.querySelector(".readout-year")?.textContent + " | " + document.querySelector(".readout-summary")?.textContent,
      indexHeader: document.querySelector(".atlas-index")?.textContent?.slice(0, 160),
      bodyText: document.body.innerText.slice(0, 300),
    };
  });
console.log(label, "GLOBE", JSON.stringify(await state(), null, 1));
await page.screenshot({ path: `${out}/${label}-globe.png` });
const flatButton = page.getByRole("button", { name: "Flat map", exact: true });
if (await flatButton.count()) {
  await flatButton.click();
  await page.waitForTimeout(1500);
  console.log(label, "FLAT", JSON.stringify(await state(), null, 1));
  await page.screenshot({ path: `${out}/${label}-flat.png` });
}
await page.goto(`http://127.0.0.1:${port}/#/places`);
await page.waitForTimeout(3000);
console.log(label, "PLACES", JSON.stringify(await page.evaluate(() => ({
  count: document.querySelector("#place-count")?.textContent,
  warn: document.querySelector("#map-warning")?.hidden ? null : document.querySelector("#map-warning")?.textContent,
  err: document.querySelector("#places-error")?.hidden ? null : document.querySelector("#places-error")?.textContent,
  land: document.querySelectorAll("#map path.land").length,
  nodes: document.querySelectorAll("#map circle.node").length,
}))));
await page.screenshot({ path: `${out}/${label}-places.png` });
console.log(label, "LOGS", JSON.stringify(logs, null, 1));
await browser.close();
