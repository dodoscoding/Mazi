import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("capture stable Home and memory at the required review sizes", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("firefox"),
    "Canonical visual evidence uses Chromium.",
  );
  const name = testInfo.project.name === "phone" ? "mobile" : "desktop";
  await page.setViewportSize({
    width: name === "mobile" ? 390 : 1440,
    height: name === "mobile" ? 844 : 1024,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
  await mkdir(".impeccable/review", { recursive: true });
  await page.screenshot({
    path: `.impeccable/review/${name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(page.locator(".gallery .photo-frame")).toHaveClass(/is-loaded/);
  await page.screenshot({
    path: `.impeccable/review/${name}-detail.png`,
    fullPage: true,
  });
});

test("resting atlas stops requesting animation frames", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    let frames = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        frames++;
        callback(time);
      });
    Object.defineProperty(window, "__atlasFrameCount", { get: () => frames });
  });
  await page.goto("/");
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await page.getByRole("button", { name: "Select Lake days" }).click();
  // A bounded measurement window after the selection has settled.
  await page.waitForTimeout(1200);
  const before = await page.evaluate(() =>
    Reflect.get(window, "__atlasFrameCount"),
  );
  await page.waitForTimeout(500);
  const after = await page.evaluate(() =>
    Reflect.get(window, "__atlasFrameCount"),
  );
  expect(after - before).toBeLessThanOrEqual(1);
  await testInfo.attach("idle-frame-count", {
    body: JSON.stringify({ before, after, observationMs: 500 }),
    contentType: "application/json",
  });
});
