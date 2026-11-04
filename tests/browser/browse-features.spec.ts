import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 600;

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
});

async function axeInBothThemes(page: Page) {
  for (const theme of ["night", "day"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.waitForTimeout(700);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
}

test("Memories filters the photo grid by year with removable chips", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/memories");
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", level: 1 }),
  ).toBeVisible();
  const grid = page.locator("#grid");
  await expect(grid.locator(".mem-tile img")).toHaveCount(3);
  await expect(grid.getByRole("link", { name: "Our summer" })).toBeVisible();
  await expect(page.locator("#grid-summary")).toHaveText(
    "3 of 3 photos · 1 moment · 2024 · all sources",
  );
  await expect(page.getByText("No places are recorded")).toBeVisible({
    visible: !isPhone(page),
  });

  if (isPhone(page)) {
    const open = page.getByRole("button", { name: "Filters", exact: true });
    await open.click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "2024" }).click();
    await expect(sheet.getByRole("button", { name: "2024" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await sheet.getByRole("button", { name: "Show 3 photos" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Filters · 1", exact: true }),
    ).toBeFocused();
  } else {
    const rail = page.getByRole("complementary", { name: "Filters" });
    await rail.getByRole("button", { name: "2024" }).click();
    await expect(rail.getByRole("button", { name: "2024" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  const chip = page.getByRole("button", { name: "Remove filter 2024" });
  await expect(chip).toBeVisible();
  await expect(grid.locator(".mem-tile")).toHaveCount(3);
  await chip.click();
  await expect(chip).toHaveCount(0);

  // Filters with nothing to show say so, and Reset brings every photo back.
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Filters" })
      .getByRole("button", { name: "Alice" })
      .click();
    await page.keyboard.press("Escape");
  } else
    await page
      .getByRole("complementary", { name: "Filters" })
      .getByRole("button", { name: "Alice" })
      .click();
  await expect(
    page.getByRole("button", { name: "Remove filter Alice" }),
  ).toBeVisible();
  await expect(grid.locator(".mem-tile")).toHaveCount(3);
  await axeInBothThemes(page);
  await page.getByRole("button", { name: "Remove filter Alice" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("archive Search groups a memory with its thumbnail and shows no results", async ({
  page,
}) => {
  await page.goto("/#/search");
  await expect(page.locator("#results article")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Include memories, chats, places and people" })
    .click();
  await expect(page.locator("#person")).toBeEnabled();
  await page.getByLabel("Search", { exact: true }).fill("summer");
  await page.getByRole("button", { name: "Arşivde ara" }).click();
  const memories = page.getByRole("region", { name: "Memories · 1" });
  await expect(memories).toBeVisible();
  const result = memories.getByRole("link", { name: /Our summer/ });
  await expect(result.locator("img").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /All 1/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("link", { name: "Ask this" })).toBeVisible();

  await page.getByLabel("Search", { exact: true }).fill("bicycle");
  await page.getByRole("button", { name: "Arşivde ara" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await page.getByRole("button", { name: /Photographs 1/ }).click();
  await expect(page.locator("#results article")).toBeVisible();

  await page.getByLabel("Search", { exact: true }).fill("snorkel");
  await page.getByRole("button", { name: "Arşivde ara" }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing for “snorkel”" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ask your archive instead" }),
  ).toBeVisible();
  await axeInBothThemes(page);
  await page.getByRole("button", { name: "Aramayı temizle" }).click();
  await expect(page.locator("#results article")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Discover renders rediscovery prompts from the archive", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/discover");
  await expect(
    page.getByRole("heading", { name: "Discover", level: 1 }),
  ).toBeVisible();
  const prompts = page.getByRole("region", { name: "Rediscovery prompts" });
  await expect(
    prompts.getByRole("heading", { name: "Our summer" }),
  ).toBeVisible();
  await expect(prompts).toContainText("From January 2024");
  await expect(
    prompts.getByRole("heading", { name: "A year in 3 photos" }),
  ).toBeVisible();
  await expect(page.locator("#discover-sub")).toContainText(
    "Picked from the archive for",
  );
  await expect(page.locator("#results article")).toHaveCount(3);
  await axeInBothThemes(page);
  await prompts.getByRole("link", { name: "Open memory" }).click();
  await expect(page).toHaveURL(/#\/memory\//);
});
