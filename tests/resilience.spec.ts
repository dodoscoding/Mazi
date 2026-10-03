import { test, expect } from "@playwright/test";

test("live reduced-motion change, unsupported transitions and keyboard navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Select Lake days" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Select Lake days" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("link", { name: "Open memory", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "Lake days", exact: true }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Back to atlas" }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Select The last ferry" }).click();
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "The Atlas of Us" }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(document, "startViewTransition", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The night we missed the last ferry" }),
  ).toBeFocused();
  await page.getByRole("region", { name: "Memory photographs" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("actual WebGL context loss retains selection and allows retry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await page.getByRole("button", { name: "Select Lake days" }).click();
  const lost = await page.locator("canvas").evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return !!extension;
  });
  expect(lost).toBe(true);
  await expect(page.getByText("The atlas is in flat view.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select Lake days" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Retry 3D view" }).click();
  await expect(page.getByText("The atlas is in flat view.")).toHaveCount(0);
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lake days", exact: true }),
  ).toBeVisible();
});

test("narrow widths and long content do not overflow; search and empty result are usable", async ({
  page,
}) => {
  await page.goto("/#/search");
  await page.getByRole("searchbox").fill("no such moment");
  await expect(page.getByRole("status")).toContainText(
    "No demo memories match",
  );
  await page.getByRole("searchbox").fill("2024");
  await page.getByRole("link", { name: /The night we missed/ }).click();
  for (const width of [320, 390, 768, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
