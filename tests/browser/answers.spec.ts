import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Grounded answers, live evidence, abstention and safe rendering", async ({
  page,
}, testInfo) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/#/ask");
  await page.getByLabel("Ask the archive").fill("When was bicycle?");
  await page.getByRole("button", { name: "Find evidence" }).click();
  await expect(page.locator("#answer")).toContainText("2024-01-02");
  await expect(page.locator("#answer")).toContainText("incomplete");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("evidence.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "View supporting record" }).click();
  await expect(page.locator("#record")).toContainText("Bicycle beside the sea");
  const query = new URL(page.url().split("#")[1], "http://localhost")
    .searchParams;
  await page.request.post("/api/discovery/hide", {
    data: { asset: query.get("asset"), enabled: true },
  });
  await page.reload();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator("#record")).toHaveCount(0);
  await page.request.post("/api/discovery/hide", {
    data: { asset: query.get("asset"), enabled: false },
  });
  await page.goto("/#/ask");
  await page.reload();
  await page
    .getByLabel("Ask the archive")
    .fill("Was bicycle our first trip ever?");
  await page.getByRole("button", { name: "Find evidence" }).click();
  await expect(page.locator("#notice")).toHaveText("Not enough evidence.");
  await expect(page.locator("#answer a")).toHaveCount(0);
  await page.getByLabel("Ask the archive").fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "Find evidence" }).click();
  await expect(page.locator("#notice")).toHaveText("Not enough evidence.");
  await expect(page.locator("#answer img")).toHaveCount(0);
});
