import { test, expect } from "@playwright/test";

test("old Ask links retain their query in Photos with an honest retirement notice", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/answers/ask"))
      requests.push(request.url());
  });
  await page.goto("/#/ask?question=Dinner&years=2024");
  await expect(page).toHaveURL(/#\/photos\?/);
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("Dinner");
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2024");
  await expect(
    page.getByRole("status").filter({ hasText: "AI yanıtları kaldırıldı" }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await expect(page.locator("#answer, #ask-card, #question")).toHaveCount(0);
  await page.screenshot({
    path: `work/poteto/app-simplification/ai-retired-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/#/explore");
  await expect(
    page.getByRole("link", { name: "Arşive sor", exact: true }),
  ).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("old exact photo evidence links retain accessible evidence and reject ambiguous or foreign identifiers", async ({
  page,
}) => {
  const login = await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  expect(login.ok()).toBe(true);
  const profile = await login.json();
  const atlas = await (
    await page.request.get(`/api/atlas?group=${profile.group_id}`)
  ).json();
  const photo = atlas.memories
    .flatMap(
      (memory: { photos: { caption: string; assetId: string }[] }) =>
        memory.photos,
    )
    .find(
      (photo: { caption: string }) =>
        photo.caption === "Bicycle beside the sea",
    );
  await page.goto(
    `/#/answer-evidence?group=${profile.group_id}&asset=${photo.assetId}`,
  );
  await expect(page).toHaveURL(new RegExp(`#/memory/photo-${photo.assetId}`));
  await expect(page.locator(".viewer-track img")).toHaveAttribute(
    "alt",
    "Bicycle beside the sea",
  );
  await expect(
    page.getByRole("heading", { name: "Kaynak bilgileri", exact: true }),
  ).toBeVisible();
  for (const parameters of [
    `group=${profile.group_id}&asset=missing`,
    `group=another-circle&asset=${photo.assetId}`,
    `group=${profile.group_id}&record=old-answer-citation`,
    "",
  ]) {
    await page.goto(`/#/answer-evidence?${parameters}`);
    await expect(
      page.getByRole("heading", {
        name: "Eski kanıt bağlantısı kullanılamıyor",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".viewer, .facts, #record img")).toHaveCount(0);
  }
});

test("legacy discovery search has no generated-answer fallback or prompt", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/discover?q=bicycle");
  await expect(page.locator("#results article")).toHaveCount(1);
  await expect(page.locator("#ask-card")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Ask this|Arşivine sor/ }),
  ).toHaveCount(0);
});
