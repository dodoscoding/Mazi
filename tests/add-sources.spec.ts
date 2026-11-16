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
  const source = page.locator("#sources article").filter({
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

test("Add retries failed source reads and clears controls when access is lost", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  let fail = true;
  await page.route(/\/api\/sources\?/, async (route) => {
    if (!fail) return route.continue();
    fail = false;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic source outage" }),
    });
  });
  await page.goto("/#/add?section=sources");
  await expect(page.locator("#sources")).toContainText(
    "Sources could not load. Refresh connections to retry.",
  );
  await page
    .getByRole("button", { name: "Refresh connections", exact: true })
    .click();
  await expect(page.locator("#sources")).toContainText("Synthetic Photos");
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Refresh connections", exact: true })
    .click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator("#sources")).toHaveCount(0);
  await expect(page.locator("#source-form")).toHaveCount(0);
});

test("Add consumes the retained Discord return and creates a scoped paused source", async ({
  page,
}) => {
  await page.route("https://discord.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Synthetic Discord</title>",
    }),
  );
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/#/add?section=sources");
  await page
    .getByRole("combobox", { name: "Source", exact: true })
    .selectOption("discord");
  await page
    .getByRole("button", { name: "Connect a Discord server", exact: true })
    .click();
  await page.waitForURL(/^https:\/\/discord\.com\/oauth2\/authorize/);
  const install = new URL(page.url());
  const redirect = new URL(install.searchParams.get("redirect_uri")!);
  expect(redirect.pathname).toBe("/places");
  redirect.searchParams.set("code", "synthetic-code");
  redirect.searchParams.set("state", install.searchParams.get("state")!);
  // Keep the configured callback URI; #159 will translate its legacy route.
  redirect.hash = "/add?section=sources";
  await page.goto(redirect.href);
  await expect(page.locator("#notice")).toContainText(
    "Lake house is connected",
  );
  expect(new URL(page.url()).search).toBe("");
  await expect(
    page.getByRole("combobox", { name: "Server", exact: true }),
  ).toHaveValue("77");
  await page
    .getByRole("group", { name: "Channels", exact: true })
    .getByLabel("#photos")
    .check();
  const form = page.locator("#source-form");
  await form.getByLabel("Name", { exact: true }).fill("Add Discord source");
  await form.getByLabel("From", { exact: true }).fill("2024-01-01");
  await form.getByLabel("Through", { exact: true }).fill("2024-12-31");
  await form
    .getByRole("button", { name: "Create paused source", exact: true })
    .click();
  const source = page
    .locator("#sources article")
    .filter({ hasText: "Add Discord source" })
    .last();
  await expect(source).toContainText("Lake house · #photos");
  await expect(source).toContainText("Paused");
});
