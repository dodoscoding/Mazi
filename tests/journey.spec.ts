import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openFullMemory, settled } from "./helpers/atlas";

test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Sample", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
});

test("select, open, explore photos and context; Back restores selection and focus", async ({
  page,
}) => {
  await page.goto("/?demo=1#/atlas");
  await page.getByRole("button", { name: "Select Lake days" }).click();
  await expect(
    page.getByRole("heading", { name: "Lake days", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select The last ferry" }).click();
  await openFullMemory(page);
  await expect(page).toHaveURL(/memory\/last-ferry/);
  await expect(
    page.getByRole("heading", { name: "The night we missed the last ferry" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show conversation" }).click();
  await expect(
    page.getByText("Worth missing the ferry for.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open memory" })).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Select The last ferry" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("deep links, photo boundaries, browser history and unknown IDs", async ({
  page,
}) => {
  await page.goto("/?demo=1#/memory/last-ferry");
  await expect(
    page.getByRole("button", { name: "Previous photo" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next photo" }).click();
  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(page.getByRole("button", { name: "Next photo" })).toBeDisabled();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "The night we missed the last ferry" }),
  ).toBeVisible();
  await page.goto("/?demo=1#/memory/missing");
  await expect(
    page.getByRole("heading", { name: "Memory not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım" }),
  ).toBeVisible();
});

test("reduced motion, fast reversals, no overflow and basic accessibility", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?demo=1#/atlas");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Select Lake days" }).click();
    await page.getByRole("button", { name: "Select The last ferry" }).click();
    await openFullMemory(page);
    await page.getByRole("link", { name: "Back", exact: true }).click();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await openFullMemory(page);
  await settled(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("failed images are recoverable and renderer failure preserves the journey", async ({
  page,
}) => {
  await page.route("**/media/ferry.webp", (route) => route.abort());
  await page.goto("/?demo=1&scene=off#/atlas");
  await openFullMemory(page);
  await expect(
    page
      .locator(".memory-detail")
      .getByText("This photo could not load.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/media/ferry.webp");
  await page.getByRole("button", { name: "Retry photo" }).click();
  await expect(page.locator(".photo-frame img")).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page.getByText("The atlas is in flat view.")).toBeVisible();
  await page.getByRole("button", { name: "Select Lake days" }).click();
  await openFullMemory(page);
  await expect(page).toHaveURL(/memory\/lake-days/);
  await expect(
    page.getByRole("heading", { name: "Lake days", exact: true }),
  ).toBeVisible();
});

test("retrying the Home photograph stays on Home", async ({ page }) => {
  await page.route("**/media/ferry.webp", (route) => route.abort());
  await page.goto("/?demo=1");
  await expect(page.getByText("This photo could not load.")).toBeVisible();
  await page.unroute("**/media/ferry.webp");
  await page.getByRole("button", { name: "Retry photo" }).click();
  await expect(page).not.toHaveURL(/memory\/last-ferry/);
  await expect(page.locator(".home-featured .photo-frame")).toHaveClass(
    /is-loaded/,
  );
});
