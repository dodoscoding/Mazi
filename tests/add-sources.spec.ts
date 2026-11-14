import { test, expect } from "@playwright/test";

test("Add manages source connections and retained transfer outcomes without a map", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/add");
  await page
    .getByRole("link", { name: "Source connections", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/add\?section=sources$/);
  await expect(
    page.getByRole("heading", { name: "Add", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", {
      name: "Shared places on a longitude and latitude map",
    }),
  ).toHaveCount(0);
  const source = page
    .locator("#sources article")
    .filter({
      has: page.getByRole("heading", { name: "Synthetic Photos", exact: true }),
    });
  await expect(source).toContainText("Paused");
  await source
    .getByRole("button", { name: "View transfers", exact: true })
    .click();
  await expect(page.locator("#resources article")).toHaveCount(3);
  await expect(page.locator("#resources")).toContainText(
    "Paused · resume from companion",
  );
  await expect(
    page.getByRole("link", { name: "Download original resource", exact: true }),
  ).toHaveCount(2);
  await source
    .getByRole("button", { name: "Enable source", exact: true })
    .click();
  await expect(source).toContainText("On · permission: authorized");
  await source
    .getByRole("button", { name: "Pause source", exact: true })
    .click();
  const form = page.locator("#source-form");
  await form
    .getByLabel("Name", { exact: true })
    .fill(`Add source ${info.project.name}`);
  await form.getByLabel("From", { exact: true }).fill("2024-01-01");
  await form.getByLabel("Through", { exact: true }).fill("2024-12-31");
  await form
    .getByRole("button", { name: "Create paused source", exact: true })
    .click();
  await expect(page.locator("#sources")).toContainText(
    `Add source ${info.project.name}`,
  );
  await expect(page.locator("#sources")).toContainText(
    "Authorize this source in the macOS companion to begin.",
  );
  await page.getByRole("link", { name: "Imports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add a chapter", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Source connections", exact: true })
    .click();
  await expect(page.locator("#sources")).toContainText(
    `Add source ${info.project.name}`,
  );
  await page.screenshot({
    path: `work/poteto/app-simplification/sources-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});
