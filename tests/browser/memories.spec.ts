import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("photo browsing and retained recap offer no story or capsule writing", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/memories");
  await expect(page.locator("#grid .mem-tile")).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  await page
    .getByRole("link", { name: /2024.*Annual recap|Annual recap.*2024/ })
    .click();
  await expect(page).toHaveURL(/recap=2024/);
  await expect(page.locator("#recap-scope")).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await expect(page.locator("#capsule-form, #stories textarea")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start a story", exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("retired writes cannot recreate historical stories or capsules through HTTP", async ({
  page,
}) => {
  const profile = await (
    await page.request.post("/api/entry", {
      data: { name: "Ben", code: "synthetic-shared-code" },
    })
  ).json();
  for (const operation of [
    "create",
    "write",
    "note",
    "seal",
    "subevents",
    "video",
  ])
    expect(
      (
        await page.request.post(`/api/memories/${operation}`, {
          data: { group: profile.group_id },
        })
      ).status(),
    ).toBe(410);
  await page.goto("/#/memories?section=capsules");
  await expect(page).toHaveURL(/#\/past-creations$/);
  await expect(
    page.getByText("No Past creations are currently available.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
