// Captures PR 5 review screenshots: Timeline, Search, Memories and Discover.
// Usage: node work/poteto/luminous-night/evidence/pr5/capture.mjs <sample base> <memories base>
// The sample server (tests.browser.sample_server) gives the demo Atlas and empty archive
// states; the memories server (tests.browser.memories_server) gives the synthetic archive.
// Files ending in "-photos" replace /api/atlas with the sample photographs so the grid can
// be judged with real pictures; every other shot uses the server's own data.
import { chromium, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [sample = "http://127.0.0.1:5501", archive = "http://127.0.0.1:8501"] =
  process.argv.slice(2);
const out = path.dirname(fileURLToPath(import.meta.url));
const place = (name, country, latitude, longitude) => ({
  name,
  country,
  latitude,
  longitude,
});
const photo = (name, alt) => ({
  src: `/media/${name}.webp`,
  alt,
  caption: alt,
});
const photosAtlas = {
  memories: [
    {
      id: "photos-ferry",
      kind: "memory",
      shortTitle: "The last ferry",
      title: "The night we missed the last ferry",
      date: "2024-07-12",
      year: 2024,
      approximate: true,
      by: "Your circle",
      description: "We stayed for one more story.",
      source: "whatsapp",
      photos: [
        photo("ferry", "Dinner on a terrace above the sea"),
        photo("harbor", "A ferry leaving the harbour at dusk"),
        photo("table", "Candles left on the terrace table"),
      ],
      messages: [],
      place: place("Naxos", "GR", 37.1, 25.37),
      people: { shared: ["Deniz"], conversation: ["Maya"] },
    },
    {
      id: "photos-lake",
      kind: "memory",
      shortTitle: "Lake days",
      title: "Lake days",
      date: "2023-10-16",
      year: 2023,
      approximate: false,
      by: "Your circle",
      description: "No plans, no signal.",
      source: "apple",
      photos: [photo("lake", "Friends on a jetty by a lake")],
      messages: [],
      place: place("Bohinj", "SI", 46.28, 13.88),
      people: { shared: ["Maya"], conversation: [] },
    },
    {
      id: "photos-birthday",
      kind: "memory",
      shortTitle: "Birthday weekend",
      title: "A kitchen full of our favourite people",
      date: "2022-11-05",
      year: 2022,
      approximate: false,
      by: "Your circle",
      description: "A slightly uneven cake.",
      source: "apple",
      photos: [photo("birthday", "Friends around a birthday cake")],
      messages: [],
      place: place("Nicosia", "CY", 35.18, 33.38),
      people: { shared: ["Alex"], conversation: [] },
    },
  ],
};

const browser = await chromium.launch();
async function shot(
  name,
  base,
  url,
  { phone, theme, who = "Ben", act, mock, delay } = {},
) {
  const context = await browser.newContext({
    ...(phone ? devices["iPhone 13"] : {}),
    viewport: phone
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(
    (value) => localStorage.setItem("mazi.theme", value),
    theme,
  );
  const page = await context.newPage();
  if (mock)
    await page.route("**/api/atlas?*", (route) =>
      route.fulfill({ json: photosAtlas }),
    );
  if (delay)
    await page.route(delay, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 60000));
      await route.continue().catch(() => {});
    });
  await page.request.post(`${base}/api/entry`, {
    data: { name: who, code: "synthetic-shared-code" },
  });
  await page.goto(base + url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  if (act) await act(page);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${out}/${name}-${phone ? "phone" : "desktop"}-${theme}.jpg`,
    type: "jpeg",
    quality: 80,
  });
  await context.close();
}
const search = (word) => async (page) => {
  const box = page.locator('input[type="search"]').first();
  await box.fill(word);
  await box.press("Enter");
  await page.waitForTimeout(900);
};
for (const theme of ["night", "day"])
  for (const phone of [false, true]) {
    const o = { phone, theme };
    await shot("timeline", sample, "/?demo=1#/timeline", {
      ...o,
      who: "Sample",
    });
    await shot("timeline-2024", sample, "/?demo=1#/timeline", {
      ...o,
      who: "Sample",
      act: async (page) => {
        if (phone) {
          await page.getByRole("button", { name: /Next year/ }).click();
          await page.getByRole("button", { name: /Next year/ }).click();
        } else {
          await page.getByRole("slider", { name: "Year" }).focus();
          await page.keyboard.press("End");
        }
      },
    });
    await shot("timeline-empty", sample, "/#/timeline", {
      ...o,
      who: "Sample",
    });
    await shot("search-demo", sample, "/?demo=1#/search", {
      ...o,
      who: "Sample",
      act: search("ferry"),
    });
    await shot("search-demo-none", sample, "/?demo=1#/search", {
      ...o,
      who: "Sample",
      act: search("snorkel"),
    });
    await shot("search", archive, "/#/search", { ...o, act: search("summer") });
    await shot("search-none", archive, "/#/search", {
      ...o,
      act: search("snorkel"),
    });
    await shot("search-loading", archive, "/#/search", {
      ...o,
      delay: "**/api/discovery/search?*",
    });
    await shot("memories", archive, "/#/memories", o);
    await shot("memories-photos", archive, "/#/memories", { ...o, mock: true });
    await shot("memories-filtered", archive, "/#/memories", {
      ...o,
      mock: true,
      act: async (page) => {
        if (phone) {
          await page
            .getByRole("button", { name: "Filters", exact: true })
            .click();
          const sheet = page.getByRole("dialog", { name: "Filters" });
          await sheet.getByRole("button", { name: "2024" }).click();
          await sheet.getByRole("button", { name: "2023" }).click();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: `${out}/memories-sheet-phone-${theme}.jpg`,
            type: "jpeg",
            quality: 80,
          });
          await sheet.getByRole("button", { name: /^Show/ }).click();
        } else {
          const rail = page.getByRole("complementary", { name: "Filters" });
          await rail.getByRole("button", { name: "2024" }).click();
          await rail.getByRole("button", { name: "2023" }).click();
        }
      },
    });
    await shot("memories-loading", archive, "/#/memories", {
      ...o,
      delay: "**/api/atlas?*",
    });
    await shot("memories-empty", sample, "/#/memories", {
      ...o,
      who: "Sample",
    });
    await shot("discover", archive, "/#/discover", o);
    await shot("discover-photos", archive, "/#/discover", { ...o, mock: true });
    await shot("discover-empty", sample, "/#/discover", {
      ...o,
      who: "Sample",
    });
  }
await browser.close();
