// Field-bug repro for groups A and E (FINDINGS 23 Oct 2026). Pixel 7, synthetic archive.
// Usage: BASE=http://127.0.0.1:8151 node work/poteto/keep-view-20261024/repro.mjs
// Start the backend with: MAZI_IMPORT_PORT=8151 .venv/bin/python -m tests.browser.memories_server
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../package.json", import.meta.url),
);
const { chromium, devices } = require("@playwright/test");

const base = process.env.BASE || "http://127.0.0.1:8151";
const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices["Pixel 7"],
  baseURL: base,
});
const page = await context.newPage();
const requests = [];
page.on("request", (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith("/api/") && u.pathname !== "/api/work")
    requests.push(u.pathname);
});
const login = await page.request.post("/api/entry", {
  data: { name: "Ben", code: "synthetic-shared-code" },
});
console.log("entry", login.status());

// 1. Backgrounding.
await page.goto("/");
await page.locator(".site-header").waitFor();
await page.waitForLoadState("networkidle");
await page.evaluate(() => {
  document.querySelector(".site-header").dataset.probe = "same-node";
  window.__statuses = [];
  new MutationObserver(() => {
    const s = document.querySelector('main [role="status"]');
    if (s) window.__statuses.push(s.textContent);
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
});
requests.length = 0;
const setHidden = (hidden) =>
  page.evaluate((hidden) => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
await setHidden(true);
await page.waitForTimeout(300);
const whileHidden = await page.evaluate(() => ({
  header: !!document.querySelector(".site-header"),
  status: document.querySelector('main [role="status"]')?.textContent || null,
  canvas: document.querySelectorAll("canvas").length,
}));
console.log("while hidden", JSON.stringify(whileHidden));
await setHidden(false);
await page.locator(".site-header").waitFor();
await page.waitForLoadState("networkidle");
const after = await page.evaluate(() => ({
  sameHeaderNode:
    document.querySelector(".site-header")?.dataset.probe === "same-node",
  statusesSeen: [...new Set(window.__statuses)],
}));
console.log("after visible", JSON.stringify(after));
console.log("api requests on return", JSON.stringify(requests));

// 2. Home -> Imports -> Home must not refetch the atlas.
requests.length = 0;
await page.evaluate(() => (location.hash = "#/imports"));
await page.waitForLoadState("networkidle");
await page.evaluate(() => (location.hash = "#/"));
await page.locator(".site-header").waitFor();
await page.waitForLoadState("networkidle");
console.log(
  "atlas requests for Home -> Imports -> Home",
  JSON.stringify(requests.filter((path) => path === "/api/atlas")),
);

// 3. Timeline -> memory -> Back to atlas returns to Timeline; phone Back does not reopen it.
await page.evaluate(() => (location.hash = "#/timeline"));
await page.waitForLoadState("networkidle");
const memoryLink = page.locator('main a[href^="#/memory/"]').first();
await memoryLink.click();
await page.locator(".back-pill").waitFor();
const memoryHash = await page.evaluate(() => location.hash);
await page.locator(".back-pill").click();
await page.waitForTimeout(400);
const afterBack = await page.evaluate(() => location.hash);
await page.goBack();
await page.waitForTimeout(400);
const afterHistoryBack = await page.evaluate(() => location.hash);
console.log(
  "timeline -> memory -> Back",
  JSON.stringify({ memoryHash, afterBack, afterHistoryBack }),
);
await browser.close();
