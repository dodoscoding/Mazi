import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Grounded answers, live evidence, abstention and safe rendering", async ({
  page,
}, testInfo) => {
  await page.request.post("/api/login", {
    data: { email: "ben@example.test", password: "correct horse battery" },
  });
  await page.goto("/ask");
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
    path: `phase6/evidence/${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "View supporting record" }).click();
  await expect(page.locator("#record")).toContainText("Bicycle beside the sea");
  const query = new URL(page.url()).searchParams;
  await page.request.post("/api/discovery/hide", {
    data: { asset: query.get("asset"), enabled: true },
  });
  await page.reload();
  await expect(page.locator("#notice")).toContainText("no longer available");
  await expect(page.locator("#record")).toBeEmpty();
  await page.request.post("/api/discovery/hide", {
    data: { asset: query.get("asset"), enabled: false },
  });
  await page.goto("/ask");
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
