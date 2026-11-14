import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("retired answer links retain keyword retrieval and live photo evidence", async ({
  page,
}, info) => {
  const login = await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  expect(login.ok()).toBe(true);
  const profile = await login.json();
  await page.goto("/#/ask?q=bicycle");
  await expect(page).toHaveURL(/#\/photos/);
  await expect(page.locator("#retired-answers")).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  expect(
    (
      await page.request.post("/api/answers/ask", {
        data: { group: profile.group_id, question: "When was bicycle?" },
      })
    ).status(),
  ).toBe(410);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const map = await (
    await page.request.get(`/api/atlas?group=${profile.group_id}`)
  ).json();
  const asset = map.memories
    .flatMap(
      (memory: { photos: { caption: string; assetId: string }[] }) =>
        memory.photos,
    )
    .find(
      (photo: { caption: string }) =>
        photo.caption === "Bicycle beside the sea",
    ).assetId;
  await page.goto(
    `/#/answer-evidence?group=${profile.group_id}&asset=${asset}`,
  );
  await expect(page.locator(".viewer-track img")).toHaveAttribute(
    "alt",
    "Bicycle beside the sea",
  );
  await page.screenshot({
    path: info.outputPath("retained-evidence.png"),
    fullPage: true,
  });
  try {
    expect(
      (
        await page.request.post("/api/discovery/hide", {
          data: { asset, enabled: true },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Anı bulunamadı", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".viewer, .facts, .conversation")).toHaveCount(0);
  } finally {
    expect(
      (
        await page.request.post("/api/discovery/hide", {
          data: { asset, enabled: false },
        })
      ).ok(),
    ).toBe(true);
  }
  const query = "<img src=x onerror=alert(1)>";
  await page.goto(`/#/ask?question=${encodeURIComponent(query)}`);
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue(query);
  await expect(
    page.locator("#answer, #ask-card, #conversation-list img"),
  ).toHaveCount(0);
});
