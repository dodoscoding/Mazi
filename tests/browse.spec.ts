import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Sample", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 600;

async function axeInBothThemes(page: Page) {
  for (const theme of ["night"]) {
    await page.evaluate((value) => {
      localStorage.setItem("mazi.theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.waitForTimeout(700);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.evaluate(() => localStorage.removeItem("mazi.theme"));
}

test("legacy Timeline reaches individual Photos without a second chronology browser", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/timeline");
  await expect(page).toHaveURL(/#\/photos/);
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Undated", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".timeline-globe, .tl-card")).toHaveCount(0);
  const selected = page.locator('.mem-tile[href*="lake-days"]').first();
  await selected.click();
  await expect(page).toHaveURL(/memory\/lake-days/);
  await page.getByRole("link", { name: "Geri", exact: true }).click();
  await expect(page).toHaveURL(/#\/photos/);
  await expect(selected).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Photos search finds a photograph through its memory text and clears empty results", async ({
  page,
}) => {
  await page.goto("/?demo=1#/search");
  const box = page.getByRole("searchbox", {
    name: "Fotoğraf ve konuşmalarda ara",
    exact: true,
  });
  await box.fill("jetty");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  const result = page.locator('.mem-tile[href*="lake-days"]');
  await expect(result).toHaveCount(1);
  await expect(result.getByRole("img")).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await result.click();
  await expect(
    page.getByRole("heading", { name: "Lake days", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box).toHaveValue("jetty");
  await box.fill("snorkel");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Bu filtrelerle eşleşen fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Aramayı temizle", exact: true })
    .click();
  await expect(box).toHaveValue("");
  await expect(box).toBeFocused();
  await expect(page.locator(".mem-tile").first()).toBeVisible();
});

test("Photos and search empty states have no axe violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/timeline");
  await expect(page.locator(".mem-tile").first()).toBeVisible();
  await axeInBothThemes(page);
  await page.getByRole("searchbox").fill("ferry");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(page.locator(".mem-tile").first()).toBeVisible();
  await axeInBothThemes(page);
  await page.getByRole("searchbox").fill("snorkel");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Bu filtrelerle eşleşen fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await axeInBothThemes(page);
});

test("Globe replays every sharing-only memory within one year and supports pause and restart", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const memories = [1, 2, 3].map((i) => ({
    id: `shared-${i}`,
    shortTitle: `Shared ${i}`,
    title: `Shared ${i}`,
    date: "Date not recorded",
    year: null,
    approximate: false,
    by: "Circle",
    description: "Synthetic",
    place: null,
    people: { shared: [], conversation: [] },
    messages: [],
    photos: [
      {
        src: "/media/ferry.webp",
        alt: "Synthetic",
        caption: "",
        provenance: [
          {
            sender: "Ana",
            source: "whatsapp",
            sharedAt: {
              local: `2025-01-0${i}`,
              raw: null,
              precision: "day",
              ambiguous: false,
            },
          },
        ],
      },
    ],
  }));
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories } }),
  );
  await page.goto("/#/");
  const replay = page.getByRole("button", {
    name: "Yeniden oynat",
    exact: true,
  });
  await replay.click();
  await expect(page).toHaveURL(/selected=shared-1/);
  await page.clock.runFor(1400);
  await expect(page).toHaveURL(/selected=shared-2/);
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  await page.clock.runFor(1600);
  await expect(page).toHaveURL(/selected=shared-2/);
  await replay.click();
  await page.clock.runFor(1400);
  await expect(page).toHaveURL(/selected=shared-3/);
  await page.clock.runFor(1400);
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page).toHaveURL(/selected=shared-1/);
});

test("manual Globe navigation resets the paused replay cursor and keeps approximate capture labels", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  const memories = [2020, 2021, 2025, 2026].map((year) => ({
    id: `year-${year}`,
    shortTitle: `Year ${year}`,
    title: `Year ${year}`,
    date: `${year}-01-01`,
    year,
    approximate: true,
    by: "Circle",
    description: "Synthetic",
    place: null,
    people: { shared: [], conversation: [] },
    messages: [],
    photos: [{ src: "/media/ferry.webp", alt: "Synthetic", caption: "" }],
  }));
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories } }),
  );
  await page.goto("/#/");
  await expect(page.locator(".featured")).toContainText("About");
  await page
    .getByRole("button", { name: "Yeniden oynat", exact: true })
    .click();
  await page.getByRole("button", { name: "Duraklat", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Yıl", exact: true });
  if (await slider.isVisible()) {
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
  } else {
    await page
      .getByRole("button", { name: "Year 2025 anısını seç", exact: true })
      .click();
  }
  await expect(page).toHaveURL(/selected=year-2025/);
  await page
    .getByRole("button", { name: "Yeniden oynat", exact: true })
    .click();
  await page.clock.runFor(1400);
  await expect(page).toHaveURL(/selected=year-2026/);
});
