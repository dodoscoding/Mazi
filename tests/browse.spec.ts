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
  for (const theme of ["night", "day"]) {
    await page.evaluate((value) => {
      localStorage.setItem("mazi.theme", value);
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.waitForTimeout(700);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.evaluate(() => localStorage.removeItem("mazi.theme"));
}

test("choosing a year moves the timeline scrubber, card and list together", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/timeline");
  const list = page.getByRole("list", { name: "Moments by year" });
  await expect(list.getByRole("heading", { level: 2 })).toHaveText([
    "2022",
    "2023",
    "2024",
  ]);
  const card = page.locator(".timeline-globe");
  await expect(card).toHaveAttribute("data-year", "2022");
  await expect(card).toContainText("Nicosia, Cyprus");
  if (isPhone(page)) {
    await page.getByRole("button", { name: "Next year, 2023" }).click();
    await expect(card).toHaveAttribute("data-year", "2023");
    await page.getByRole("button", { name: "Next year, 2024" }).click();
  } else {
    const slider = page.getByRole("slider", { name: "Year" });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "2023");
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "2024");
  }
  await expect(card).toHaveAttribute("data-year", "2024");
  await expect(card).toContainText("Bohinj → Naxos");
  await expect(page.locator('li[data-year="2024"]')).toHaveClass(/is-current/);
  await expect(page.locator('li[data-year="2024"]')).toBeInViewport();

  // Scrolling the list back to the top moves the year in view.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(card).toHaveAttribute("data-year", "2022");
  if (!isPhone(page))
    await expect(page.getByRole("slider", { name: "Year" })).toHaveAttribute(
      "aria-valuenow",
      "2022",
    );
  if (!isPhone(page)) {
    await page.getByRole("button", { name: "Newest first" }).click();
    await expect(list.getByRole("heading", { level: 2 })).toHaveText([
      "2024",
      "2023",
      "2022",
    ]);
  }
  await page
    .getByRole("link", { name: /Lake days/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/memory\/lake-days/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("search finds a memory by a word from its story and shows its thumbnail", async ({
  page,
}) => {
  await page.goto("/?demo=1#/search");
  const box = page.getByRole("searchbox", { name: "Search the archive" });
  await box.fill("jetty");
  const result = page.getByRole("link", { name: /Lake days/ });
  await expect(result).toBeVisible();
  await expect(result.locator("img").first()).toBeVisible();
  await expect(result.locator("mark")).toHaveText("jetty");
  await expect(
    page.getByRole("button", { name: /Memories 1/, pressed: false }),
  ).toBeVisible();

  await box.fill("ferry");
  await expect(
    page.getByRole("heading", { name: "Chat snippets · 2" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Chats 2/ }).click();
  await expect(page.getByRole("heading", { name: "Memories · 1" })).toHaveCount(
    0,
  );

  await box.fill("snorkel");
  await expect(
    page.getByRole("heading", { name: "Nothing for “snorkel”" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "No demo memories match “snorkel”",
  );
  await page.getByRole("button", { name: "Naxos", exact: true }).click();
  await expect(box).toHaveValue("Naxos");
  await expect(
    page.getByRole("link", { name: /last ferry/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(box).toHaveValue("");
  await expect(box).toBeFocused();
});

test("Timeline and Search have no axe violations in night or day", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/timeline");
  await expect(page.locator(".timeline-globe")).toHaveAttribute(
    "data-year",
    "2022",
  );
  await axeInBothThemes(page);
  await page.goto("/?demo=1#/search");
  await page.getByRole("searchbox").fill("ferry");
  await expect(page.getByRole("link", { name: /last ferry/ })).toBeVisible();
  await axeInBothThemes(page);
  await page.getByRole("searchbox").fill("snorkel");
  await expect(page.getByRole("status")).toContainText("No demo memories");
  await axeInBothThemes(page);
});
