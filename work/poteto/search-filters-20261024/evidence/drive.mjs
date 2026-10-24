// node drive.mjs <port> <dataDir> [width height label]
import { chromium } from "../../../../node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";

const [port, dir, w = "1440", h = "1000", label = "desktop"] =
  process.argv.slice(2);
const out = new URL(".", import.meta.url).pathname;
const origin = `http://127.0.0.1:${port}`;
const { token } = JSON.parse(readFileSync(`${dir}/session.json`, "utf8"));
const browser = await chromium.launch({
  args: ["--disable-gpu", "--js-flags=--max-old-space-size=512"],
});
try {
  const context = await browser.newContext({
    viewport: { width: +w, height: +h },
  });
  await context.addCookies([
    { name: "mazi_session", value: token, url: origin },
  ]);
  const page = await context.newPage();
  const logs = [];
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  page.on(
    "console",
    (m) => m.type() === "error" && logs.push(`console: ${m.text()}`),
  );
  const searches = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/discovery/search"))
      searches.push(Object.fromEntries(new URL(r.url()).searchParams));
  });
  const snapshot = () =>
    page.evaluate(() => {
      const texts = (selector) =>
        [...document.querySelectorAll(selector)]
          .filter((el) => !el.closest("[hidden]"))
          .map((el) => el.textContent.trim());
      return {
        url: location.hash,
        query: document.querySelector("#query")?.value,
        chips: texts("#source-filter button"),
        pressed: texts("#source-filter button[aria-pressed=true]"),
        sharedBy: document.querySelector("#shared-by")?.value,
        sharedByOptions: texts("#shared-by option"),
        photos: texts("#results article h3"),
        photoLines: texts("#results .disc-shared"),
        memories: texts("#memory-list .result-title"),
        chats: texts("#chat-list b"),
        total: document.querySelector("#result-total")?.textContent,
      };
    });
  const step = async (name) => {
    await page.waitForTimeout(700);
    const state = await snapshot();
    console.log(name, JSON.stringify(state));
    await page.screenshot({ path: `${out}/${label}-${name}.png` });
    return state;
  };

  await page.goto(`${origin}/#/search`);
  await page.locator("#search-filters").waitFor({ state: "visible" });
  await step("01-filters-offered");
  await page.locator("#query").fill("lake");
  await page.locator("#query").press("Enter");
  await page
    .getByRole("button", { name: "Include memories, chats, places and people" })
    .click();
  await page.locator("#memory-list a").first().waitFor();
  await step("02-lake-all");
  await page
    .locator("#source-filter")
    .getByRole("button", { name: "Discord", exact: true })
    .click();
  await step("03-source-discord");
  await page
    .locator("#source-filter")
    .getByRole("button", { name: "All", exact: true })
    .click();
  await page.locator("#shared-by").selectOption("Ana");
  const ana = await step("04-shared-by-ana");
  await page.locator("#memory-list a").first().click();
  await page.waitForTimeout(1500);
  console.log(
    "05-opened",
    JSON.stringify({
      url: await page.evaluate(() => location.hash),
      heading: await page.locator("h1").first().textContent(),
    }),
  );
  await page.screenshot({ path: `${out}/${label}-05-opened-memory.png` });
  await page.goBack();
  await page.locator("#search-filters").waitFor({ state: "visible" });
  await page.locator("#results article").first().waitFor();
  const back = await step("06-back-restored");
  console.log(
    "CHECK",
    JSON.stringify({
      backKeepsQuery: back.query === "lake",
      backKeepsSharedBy: back.sharedBy === "Ana",
      backKeepsPhotos: back.photos.join() === ana.photos.join(),
      lastRequest: searches.at(-1),
    }),
  );
  console.log("LOGS", JSON.stringify(logs));
} finally {
  await browser.close();
}
