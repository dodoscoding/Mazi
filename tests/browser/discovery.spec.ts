import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("People, combined retrieval, hiding and consent work without recognition", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/#/discover");
  await expect(page.locator("#results article")).toHaveCount(3);
  const groupAlreadyOn = await page
    .getByLabel("Enable optional local processing")
    .isChecked();
  await page.getByLabel("Search mode").selectOption("semantic");
  const searched = page.waitForResponse(
    (response) =>
      response.url().includes("/api/discovery/search") &&
      response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Search archive" }).click();
  await searched;
  await expect(
    page.getByRole("button", { name: "Find similar colors" }),
  ).toHaveCount(groupAlreadyOn ? 3 : 0);
  await page.getByLabel("Search mode").selectOption("keyword");
  await page
    .getByText("My visibility & processing choices", { exact: true })
    .click();
  await page.getByLabel("Enable optional local processing").check();
  await expect(page.locator("#processing-status")).toContainText(
    "Group processing on",
  );
  await page.getByLabel("Allow local related-search processing").check();
  await expect(page.locator("#notice")).toHaveText("Changes saved.");
  await page.getByLabel("Search mode").selectOption("semantic");
  await page.getByLabel("Search", { exact: true }).fill("bike");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await expect(page.locator("#results")).toContainText(
    "Bicycle beside the sea",
  );
  await expect(
    page.getByRole("button", { name: "Find similar colors" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Hide from my discovery" }).click();
  await expect(page.locator("#results article")).toHaveCount(0);
  await page.getByRole("button", { name: "Restore hidden photograph" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await page.getByLabel("Allow local related-search processing").uncheck();
  await expect(page.locator("#results article")).toHaveCount(0);
  await page.getByLabel("Search", { exact: true }).fill("bicycle");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(1);
  await page.getByLabel("Person’s name").fill("<img src=x onerror=alert(1)>");
  await page
    .getByRole("button", { name: "Create person", exact: true })
    .click();
  await expect(page.locator("#people")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#people img")).toHaveCount(0);
  await page.getByLabel("Search", { exact: true }).fill("");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(3);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("discovery.png"),
    fullPage: true,
  });
  const group = await page.locator("#groups").inputValue();
  expect(
    (
      await page.request.post("/api/discovery/person", {
        headers: { Origin: "https://elsewhere.test" },
        data: { group, name: "No" },
      })
    ).status(),
  ).toBe(403);
  await page.request.post("/api/logout", { data: {} });
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.reload();
  await page
    .locator("#results article")
    .first()
    .getByRole("button", { name: "Remove my association" })
    .click();
  await page
    .getByText("My visibility & processing choices", { exact: true })
    .click();
  await expect(page.locator("#suppressed")).toContainText(
    "Restore my Ben association",
  );
  await page
    .getByRole("button", { name: "Restore my Ben association" })
    .click();
  await expect(page.locator("#suppressed")).toBeEmpty();
  await page.request.post("/api/logout", { data: {} });
  await page.context().addCookies([
    {
      name: "mazi_session",
      value: "synthetic-unmapped-session",
      url: new URL(page.url()).origin,
    },
  ]);
  const denied = await page.request.get("/api/discovery/search?group=" + group);
  expect(denied.status()).toBe(403);
  expect(await denied.text()).not.toContain("Amsterdam");
  await page.getByRole("button", { name: "Search archive" }).click();
  await expect(page.locator("#results article")).toHaveCount(0);
  await expect(page.locator("#private")).toBeHidden();
  expect(errors).toEqual([]);
});
