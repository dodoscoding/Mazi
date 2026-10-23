import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("authorized places, filters, optional paths, source controls and privacy", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/#/places");
  await expect(page.locator("#places article")).toHaveCount(2);
  await expect(page.locator("#map .route")).toHaveCount(0);
  await page.getByLabel("Show travel paths by date").check();
  await expect(page.locator("#map .route")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("NL");
  await expect(page.locator("#places article")).toHaveCount(1);
  await expect(page.locator("#map .route")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("");
  await expect(page.locator("#places article")).toHaveCount(2);
  await page
    .locator("#source-form")
    .getByLabel("Name", { exact: true })
    .fill("<script>alert(1)</script>");
  await page.getByLabel("From", { exact: true }).fill("2024-01-01");
  await page.getByLabel("Through", { exact: true }).fill("2024-12-31");
  await page.getByRole("button", { name: "Create paused source" }).click();
  await expect(page.locator("#sources")).toContainText(
    "<script>alert(1)</script>",
  );
  await expect(page.locator("#sources script")).toHaveCount(0);
  const source = page.locator("#sources article").first();
  if (await source.getByRole("button", { name: "Pause source" }).count())
    await source.getByRole("button", { name: "Pause source" }).click();
  await expect(source).toContainText("Paused");
  await source.getByRole("button", { name: "View transfers" }).click();
  await expect(page.locator("#resources article")).toHaveCount(3);
  await expect(page.locator("#resources")).toContainText(
    "Paused · resume from companion",
  );
  await expect(
    page.getByRole("link", { name: "Download original resource" }),
  ).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("places.png"),
    fullPage: true,
  });
  const group = await page.locator("#groups").inputValue();
  expect(
    (
      await page.request.post("/api/places", {
        headers: { Origin: "https://other.example" },
        data: { origin: "x" },
      })
    ).status(),
  ).toBe(403);
  await page.request.post("/api/logout", { data: {} });
  await page.context().addCookies([
    {
      name: "mazi_session",
      value: "synthetic-unmapped-session",
      url: new URL(page.url()).origin,
    },
  ]);
  const response = await page.request.get("/api/places?group=" + group);
  expect(response.status()).toBe(403);
  expect(await response.text()).not.toContain("Amsterdam");
  await page.getByRole("button", { name: "Refresh places" }).click();
  await expect(page.locator("#map circle")).toHaveCount(0);
  await expect(page.locator("#places article")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a member connects a Discord server and picks its channels", async ({
  page,
  baseURL,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://discord.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Synthetic Discord</title>",
    }),
  );
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/places");
  await page
    .getByRole("combobox", { name: "Source", exact: true })
    .selectOption("discord");
  await page.getByRole("button", { name: "Connect a Discord server" }).click();
  await page.waitForURL(/^https:\/\/discord\.com\/oauth2\/authorize/);
  const install = new URL(page.url());
  expect(install.searchParams.get("redirect_uri")).toBe(`${baseURL}/places`);
  expect(install.searchParams.get("permissions")).toBe("66560");
  expect(install.searchParams.get("scope")).toBe("bot identify");
  const state = install.searchParams.get("state");
  await page.goto(`/places?code=synthetic-code&state=${state}`);
  await expect(page.locator("#notice")).toContainText(
    "Lake house is connected",
  );
  expect(new URL(page.url()).search).toBe("");
  await expect(
    page.getByRole("combobox", { name: "Server", exact: true }),
  ).toHaveValue("77");
  const form = page.locator("#source-form");
  await form.getByLabel("Name", { exact: true }).fill("Lake trip");
  await form.getByLabel("From", { exact: true }).fill("2024-01-01");
  await form.getByLabel("Through", { exact: true }).fill("2024-12-31");
  await page.getByRole("button", { name: "Create paused source" }).click();
  await expect(page.locator("#notice")).toContainText(
    "Choose at least one channel.",
  );
  await page
    .getByRole("group", { name: "Channels" })
    .getByLabel("#photos")
    .check();
  await page.getByRole("button", { name: "Create paused source" }).click();
  await expect(
    page.locator("#sources article", { hasText: "Lake trip" }).last(),
  ).toContainText("Lake house · #photos");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#source-form").screenshot({
    path: testInfo.outputPath("discord-source.png"),
  });
  await page.goto(`/places?code=synthetic-code&state=${state}`);
  await expect(page.locator("#notice")).toContainText(
    "This Discord connection expired",
  );
  await expect(page.locator("#workspace")).toBeVisible();
  expect(errors).toEqual([]);
});
