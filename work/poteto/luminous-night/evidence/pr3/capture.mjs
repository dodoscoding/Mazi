// Captures the PR 3 evidence screenshots (JPEG q80) against a running sample server.
// Usage: MAZI_IMPORT_PORT=5301 .venv/bin/python -m tests.browser.sample_server, then
// node work/poteto/luminous-night/evidence/pr3/capture.mjs [baseURL]
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5301";
const dir = new URL("./", import.meta.url).pathname;
const sizes = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};
const browser = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

async function shot(
  file,
  size,
  theme,
  url,
  { intro = false, wait = 2500, before, route } = {},
) {
  const phone = size === "phone";
  const context = await browser.newContext({
    viewport: sizes[size],
    isMobile: phone,
    hasTouch: phone,
  });
  const page = await context.newPage();
  await page.request.post(base + "/api/entry", {
    data: { name: "Sample", code: "synthetic-shared-code" },
  });
  await context.addInitScript(
    (value) => localStorage.setItem("mazi.theme", value),
    theme,
  );
  if (!intro)
    await context.addInitScript(() =>
      sessionStorage.setItem("mazi.intro", "seen"),
    );
  if (route)
    await page.route(route.url, async (request) => {
      if (route.hold) return new Promise(() => {});
      await request.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      });
    });
  await page.goto(base + url);
  await page.waitForTimeout(wait);
  if (before) await before(page);
  await page.screenshot({
    path: `${dir}${file}.jpg`,
    type: "jpeg",
    quality: 80,
  });
  await context.close();
}

const openPortal = async (page) => {
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await page.waitForTimeout(2000);
};

for (const theme of ["night", "day"])
  for (const size of ["desktop", "phone"]) {
    const tag = `${size}-${theme}`;
    await shot(`atlas-${tag}`, size, theme, "/?demo=1");
    await shot(`flat-${tag}`, size, theme, "/?demo=1&scene=off");
    await shot(`portal-${tag}`, size, theme, "/?demo=1", {
      before: openPortal,
    });
    await shot(`empty-${tag}`, size, theme, "/");
    await shot(`loading-${tag}`, size, theme, "/", {
      wait: 1200,
      route: { url: "**/api/atlas?*", hold: true },
    });
    await shot(`error-${tag}`, size, theme, "/", {
      wait: 1500,
      route: { url: "**/api/atlas?*" },
    });
  }
await shot("intro-desktop-night", "desktop", "night", "/?demo=1", {
  intro: true,
  wait: 1900,
});
await shot("intro-phone-night", "phone", "night", "/?demo=1", {
  intro: true,
  wait: 1900,
});
await shot("sheet-open-phone-night", "phone", "night", "/?demo=1", {
  before: async (page) => {
    await page
      .getByRole("button", { name: "Show more places and memories" })
      .click();
    await page.waitForTimeout(600);
  },
});
await shot("hover-turn-desktop-night", "desktop", "night", "/?demo=1", {
  before: async (page) => {
    await page
      .getByRole("navigation", { name: "Places and moments" })
      .getByRole("button", { name: /^Bohinj/ })
      .hover();
    await page.waitForTimeout(1200);
  },
});
for (const [name, viewport] of [
  ["1150", { width: 1150, height: 800 }],
  ["800", { width: 800, height: 1000 }],
]) {
  sizes[name] = viewport;
  await shot(`atlas-${name}-night`, name, "night", "/?demo=1");
}
await browser.close();
