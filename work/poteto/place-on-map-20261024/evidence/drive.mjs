// node drive.mjs <port> <dataDir> <label> <width> <height>
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const [port, dir, label, w, h] = process.argv.slice(2);
const out = new URL(".", import.meta.url).pathname;
const { token } = JSON.parse(readFileSync(`${dir}/session.json`, "utf8"));
const base = `http://127.0.0.1:${port}`;
const report = { label, viewport: [+w, +h], steps: [], logs: [] };
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: +w, height: +h }, isMobile: +w < 600, hasTouch: +w < 600 });
  await context.addCookies([{ name: "mazi_session", value: token, url: base }]);
  const page = await context.newPage();
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && report.logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => report.logs.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && report.logs.push(`HTTP ${r.status()} ${r.url()}`));
  const state = (step) =>
    page.evaluate((step) => {
      const tray = document.querySelector(".place-tray");
      const rect = (el) => el && Object.fromEntries(Object.entries(el.getBoundingClientRect().toJSON()).map(([k, v]) => [k, Math.round(v)]));
      return {
        step,
        stage: document.querySelector(".atlas-stage")?.dataset.flat ? "flat" : "globe",
        globeReady: document.querySelector(".atlas-stage")?.dataset.ready === "true",
        readout: document.querySelector(".readout-summary")?.textContent,
        indexTitle: document.querySelector(".index-title")?.textContent,
        trayOpen: tray?.dataset.open === "true",
        trayCount: document.querySelector(".place-tray-count")?.textContent ?? null,
        trayRows: [...document.querySelectorAll(".place-tray-name")].map((e) => e.textContent),
        trayRect: rect(tray),
        stageRect: rect(document.querySelector(".atlas-stage")),
        flatNodes: document.querySelectorAll(".flat-node").length,
        globeLabels: [...document.querySelectorAll(".globe-label")].map((e) => e.textContent),
        featured: document.querySelector(".featured-meta")?.textContent,
        toast: [...document.querySelectorAll(".toast-region *")].map((e) => e.textContent).filter(Boolean)[0] ?? null,
        status: document.querySelector(".place-status")?.textContent ?? null,
        horizontalScroll: document.documentElement.scrollWidth > innerWidth,
      };
    }, step);
  const shot = async (name) => {
    await page.screenshot({ path: `${out}/${label}-${name}.png` });
    report.steps.push(await state(name));
  };
  const view = (name) => page.getByRole("button", { name, exact: true }).click();
  const openTray = async () => {
    const toggle = page.locator(".place-tray-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  };
  await page.goto(`${base}/`);
  await page.waitForTimeout(7000);
  await shot("1-empty-globe");
  await view("Flat map");
  await page.waitForTimeout(1200);
  await shot("2-empty-flat");
  await view("Globe");
  await page.waitForTimeout(2500);
  await openTray();
  await page.locator(".place-tray-row", { hasText: "Lake weekend" }).click();
  await page.locator(".place-field input").fill("girne");
  await page.waitForTimeout(400);
  await shot("3-typing-girne");
  const placed = page.waitForResponse((r) => r.url().endsWith("/api/atlas/place"));
  await page.locator(".place-field input").press("Enter");
  report.placeResponse = await (await placed).json();
  await page.waitForResponse((r) => r.url().includes("/api/atlas?"));
  await page.waitForTimeout(3500);
  await shot("4-after-globe");
  await view("Flat map");
  await page.waitForTimeout(1500);
  await shot("5-after-flat");
  await view("Globe");
  await page.waitForTimeout(1500);
  await openTray();
  await page.locator(".place-tray-row").first().click();
  await page.locator(".place-field input").fill("Victoria");
  await page.locator(".place-field input").press("Enter");
  await page.waitForSelector(".place-candidate");
  await shot("6-ambiguous");
  await page.goto(`${base}/#/places`);
  await page.waitForTimeout(3000);
  report.places = await page.evaluate(() => ({
    count: document.querySelector("#place-count")?.textContent,
    rows: [...document.querySelectorAll("#places .place-row h3")].map((e) => e.textContent),
    nodes: document.querySelectorAll("#map circle.node").length,
  }));
  await page.screenshot({ path: `${out}/${label}-7-places.png` });
} finally {
  await browser.close();
}
writeFileSync(`${out}/${label}-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
