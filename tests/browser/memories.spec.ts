import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Annual recap and collaborative story editing", async ({
  page,
}, testInfo) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/#/memories");
  await expect(page.locator("#recap")).toContainText("Our summer");
  await page.getByRole("button", { name: "Start a story" }).click();
  await page
    .getByLabel("Your recollection")
    .fill("<img src=x onerror=alert(1)> A beautiful day.");
  await page.getByRole("button", { name: "Save my recollection" }).click();
  await expect(page.locator("#stories")).toContainText("You: <img");
  await expect(page.locator("#stories img[onerror]")).toHaveCount(0);
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
  await page.getByLabel("Sub-event title").fill("Morning");
  await page.getByRole("checkbox", { name: "Photo 1", exact: true }).check();
  await page
    .getByRole("button", { name: "Add sub-event", exact: true })
    .click();
  await expect(page.locator("#stories")).toContainText("Morning · 1 photos");
  await page.getByRole("button", { name: "Show slideshow" }).click();
  await expect(page.locator("#stories img")).toBeVisible();
  await page.getByRole("button", { name: "Next photo" }).click();
  await expect(page.locator("#stories")).toContainText("Photo 2 of 3");
  const videoDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download video (AVI)", exact: true })
    .click();
  expect((await videoDownload).suggestedFilename()).toBe("mazi-memory.avi");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export story JSON" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("mazi-story.json");
  await page.getByRole("button", { name: "Remove my recollection" }).click();
  await expect(page.getByLabel("Your recollection")).toHaveValue("");
  await page.getByRole("button", { name: "Delete story", exact: true }).click();
  await expect(page.locator("#stories")).toContainText("No shared stories");
});

test("Capsules stay sealed with a changed browser clock", async ({ page }) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/#/memories");
  await expect(page.locator("#recap")).toContainText("Our summer");
  await page
    .getByLabel("Capsule title", { exact: true })
    .fill("Hidden surprise");
  await page.getByLabel("Note for the future").fill("These words stay sealed");
  await page.getByLabel("Opening time").fill("2030-01-01T12:00");
  await page.getByRole("button", { name: "Seal capsule", exact: true }).click();
  await expect(page.locator("#capsules")).toContainText("Sealed capsule");
  await expect(page.locator("#capsules")).not.toContainText("Hidden surprise");
  await page.clock.install({ time: new Date("2035-01-01") });
  await page.getByRole("button", { name: "Refresh stories" }).click();
  await expect(page.locator("#capsules")).toContainText("Sealed capsule");
  await expect(
    page.getByRole("button", { name: "Open capsule", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Show in-app capsule notifications").check();
  await expect(page.locator("#notifications")).toBeEmpty();
  await page
    .getByRole("button", { name: "Delete capsule", exact: true })
    .click();
  await expect(page.locator("#capsules")).toContainText(
    "No available capsules",
  );
});
