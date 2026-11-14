import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function axeInBothThemes(page: import("@playwright/test").Page) {
  for (const theme of ["night", "day"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
}

test("Photos retains year and compact place filters on individual photographs", async ({
  page,
}) => {
  await page.goto("/#/memories");
  await expect(page).toHaveURL(/#\/photos/);
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await expect(
    page.getByRole("region", { name: "Ocak 2024", exact: true }),
  ).toBeVisible();
  const year = page.getByRole("combobox", { name: "Yıl", exact: true });
  await year.selectOption("2024");
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await page.locator("#filters-open").click();
  const filters = page.getByRole("dialog", { name: "Filtreler", exact: true });
  await filters.getByLabel(/stanbul/).check();
  await filters
    .getByRole("button", { name: "1 fotoğrafı göster", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await expect(page.locator(".mem-tile img")).toHaveAttribute(
    "alt",
    "Dinner with friends",
  );
  await page.reload();
  await expect(year).toHaveValue("2024");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await page.getByRole("button", { name: /Filtreyi kaldır:.*stanbul/ }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await axeInBothThemes(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Photos search retains literal queries, empty recovery and shared viewer return", async ({
  page,
}) => {
  await page.goto("/#/search");
  await expect(page).toHaveURL(/#\/photos/);
  const query = page.getByRole("searchbox", {
    name: "Fotoğraf ve konuşmalarda ara",
    exact: true,
  });
  await query.fill("bicycle");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  const origin = page.url();
  await page.locator(".mem-tile").click();
  await expect(page.locator(".viewer-track img")).toHaveAttribute(
    "alt",
    "Bicycle beside the sea",
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(origin);
  await expect(page.locator(".mem-tile")).toBeFocused();
  await query.fill("snorkel");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Ask this|Arşivine sor/ }),
  ).toHaveCount(0);
  await axeInBothThemes(page);
  await page
    .getByRole("button", { name: "Aramayı temizle", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(3);
});

test("legacy Discover opens Photos and a capture-year recap without generation", async ({
  page,
}) => {
  await page.goto("/#/discover");
  await expect(page).toHaveURL(/#\/photos/);
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  await page
    .getByRole("link", { name: /2024.*Annual recap|Annual recap.*2024/ })
    .click();
  await expect(page).toHaveURL(/recap=2024/);
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await expect(page.locator("#recap-scope")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Start a story|Download video|Seal capsule/,
    }),
  ).toHaveCount(0);
  await page.locator(".mem-tile").first().click();
  await expect(page.locator(".viewer-track img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/recap=2024/);
});

test("selected-detail photo changes preserve a literal question mark and trailing filters", async ({
  page,
}) => {
  const profile = await (await page.request.get("/api/session")).json();
  const map = await (
    await page.request.get(`/api/atlas?group=${profile.group_id}`)
  ).json();
  const memory = map.memories.find(
    (item: { kind: string }) => item.kind === "memory",
  );
  await page.goto(
    `/#/memory/${memory.id}?photo=0&q=literal?question&people_present=none`,
  );
  await expect(page.locator(".viewer-count")).toHaveText("1 / 3");
  await page
    .getByRole("button", { name: "Sonraki fotoğraf", exact: true })
    .click();
  await expect(page.locator(".viewer-count")).toHaveText("2 / 3");
  const params = new URLSearchParams(
    new URL(page.url()).hash.split("?").slice(1).join("?"),
  );
  expect(params.get("q")).toBe("literal?question");
  expect(params.get("people_present")).toBe("none");
});
