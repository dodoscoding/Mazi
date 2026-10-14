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
