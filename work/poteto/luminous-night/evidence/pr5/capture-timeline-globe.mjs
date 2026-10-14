// Captures the Timeline with the live globe (and its flat fallback) as JPEG q80.
// Usage: MAZI_IMPORT_PORT=5512 .venv/bin/python -m tests.browser.sample_server, then
// node work/poteto/luminous-night/evidence/pr5/capture-timeline-globe.mjs [baseURL]
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5512";
const dir = new URL("./", import.meta.url).pathname;
const sizes = {
  desktop: { width: 1440, height: 900 },
  800: { width: 800, height: 1000 },
  phone: { width: 390, height: 844 },
};
const browser = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

async function shot(file, size, theme, url, after) {
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
  await context.addInitScript((value) => {
    localStorage.setItem("mazi.theme", value);
    sessionStorage.setItem("mazi.intro", "seen");
  }, theme);
  await page.goto(base + url);
  await page.waitForTimeout(3000);
  if (after) await after(page);
  await page.screenshot({
    path: `${dir}${file}.jpg`,
    type: "jpeg",
    quality: 80,
  });
  await context.close();
}

const toLastYear = async (page) => {
  if ((page.viewportSize()?.width ?? 1440) <= 800)
    for (const name of ["Next year, 2023", "Next year, 2024"])
      await page.getByRole("button", { name }).click();
  else {
    await page.getByRole("slider", { name: "Year" }).focus();
    await page.keyboard.press("End");
  }
  await page.waitForTimeout(1600);
};

for (const theme of ["night", "day"])
  for (const size of ["desktop", "phone"]) {
    await shot(
      `timeline-globe-${size}-${theme}`,
      size,
      theme,
      "/?demo=1#/timeline",
    );
    await shot(
      `timeline-globe-2024-${size}-${theme}`,
      size,
      theme,
      "/?demo=1#/timeline",
      toLastYear,
    );
    await shot(
      `timeline-flat-${size}-${theme}`,
      size,
      theme,
      "/?demo=1&scene=off#/timeline",
    );
  }
await shot("timeline-globe-800-night", "800", "night", "/?demo=1#/timeline");
await browser.close();
