import { test, expect } from "@playwright/test";

test("Photos opens from Globe as individual photographs grouped by newest month", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/atlas");
  const open = page.getByRole("link", {
    name: "Fotoğraflarda gezin",
    exact: true,
  });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page).toHaveURL(/#\/photos$/);
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", level: 1, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(8);
  await expect(page.locator(".photo-month h2")).toHaveText([
    "Nisan 2026",
    "Şubat 2025",
    "Ocak 2024",
    "Mart 2023",
    "Undated",
  ]);
  expect(
    await page
      .getByRole("region", { name: "Ocak 2024", exact: true })
      .getByRole("img")
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute("alt")),
      ),
  ).toEqual([
    "Dinner with friends",
    "Garden in the morning",
    "Bicycle beside the sea",
  ]);
  await expect(
    page.getByRole("group", { name: "Görünüm", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Diğer filtreler|Filtreler/,
      exact: false,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `work/poteto/app-simplification/photos-months-${info.project.name}.png`,
    fullPage: true,
  });
  const selected = page.locator('.mem-tile[href*="photo=1"]').first();
  await selected.click();
  await expect(page.getByText("2 / 3", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/photos$/);
  await expect(selected).toBeFocused();
});

test("Photos preserves year and compact filters across the viewer and keeps uncertain dates explicit", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/photos");
  await expect(
    page
      .getByRole("region", { name: "Undated", exact: true })
      .locator(".mem-tile"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "Nisan 2026", exact: true }),
  ).toContainText("Paylaşıldı · Çekim tarihi bilinmiyor");
  await expect(
    page.getByRole("region", { name: "Undated", exact: true }),
  ).toContainText("Çekim tarihi çelişkili");
  const year = page.getByRole("combobox", { name: "Yıl", exact: true });
  await year.selectOption("2024");
  await expect(page.locator(".mem-tile")).toHaveCount(3);
  await page.locator("#filters-open").click();
  const filters = page.getByRole("dialog", { name: "Filtreler", exact: true });
  await filters.getByLabel(/stanbul/).check();
  await filters
    .getByRole("button", { name: "1 fotoğrafı göster", exact: true })
    .click();
  await expect(filters).toHaveCount(0);
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  const origin = page.url();
  await page.locator(".mem-tile").click();
  await expect(page.locator(".viewer")).toBeVisible();
  await page
    .getByRole("link", { name: "Fotoğrafı kapat", exact: true })
    .click();
  await expect(page).toHaveURL(origin);
  await expect(year).toHaveValue("2024");
  await expect(page.locator(".mem-tile")).toBeFocused();
  await page
    .getByRole("button", { name: /Filtreyi kaldır: .*stanbul/ })
    .click();
  await year.selectOption("undated");
  await expect(page.locator(".mem-tile")).toHaveCount(2);
  await expect(page.locator(".photo-month h2")).toHaveText(["Undated"]);
  await expect(page.locator("#grid-summary")).toHaveText(
    "2 eşleşen fotoğraf · 8 görünür fotoğraf",
  );
  await page.screenshot({
    path: `work/poteto/app-simplification/photos-undated-${info.project.name}.png`,
    fullPage: true,
  });
});

test("Photos explains loading, failed loads and empty filters with recovery", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/api/atlas?*", async (route) => {
    if (!fail) return route.continue();
    fail = false;
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: "Synthetic archive unavailable" },
    });
  });
  await page.goto("/#/photos");
  await expect(
    page.getByRole("status", { name: "Fotoğraflar yükleniyor", exact: true }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar yüklenemedi", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(8);
  await page.goto("/#/photos?years=1900");
  await expect(
    page.getByRole("heading", {
      name: "Bu filtrelerle eşleşen fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Filtreleri temizle", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(8);
});

test("Photos and Globe remove withdrawn contributions and clear media on session loss", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  const session = await (await page.request.get("/api/session")).json();
  const sources = await (
    await page.request.get(`/api/sources?group=${session.group_id}`)
  ).json();
  const source = sources.find(
    (item: { label: string }) => item.label === "Synthetic Photos",
  );
  const { execFileSync } = await import("node:child_process");
  const { createHash } = await import("node:crypto");
  const data = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys; from PIL import Image; b=io.BytesIO(); Image.new('RGB',(123,67),'pink').save(b,'JPEG'); sys.stdout.buffer.write(b.getvalue())",
  ]);
  const response = await page.request.post("/api/sources/begin", {
    data: {
      connection: source.id,
      metadata: {
        item: `withdraw-${info.project.name}`,
        component: "photo",
        version: "original",
        filename: "temporary.jpg",
        date: "2024-01-02",
        capture_date: "2025-08-01",
        kind: "image",
        albums: [],
      },
      size: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    },
  });
  expect(response.ok()).toBe(true);
  const resource = await response.json();
  expect(
    (
      await page.request.post("/api/sources/chunk", {
        data: { id: resource.id, offset: 0, data: data.toString("base64") },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/sources/finish", {
        data: { id: resource.id },
      })
    ).ok(),
  ).toBe(true);
  await expect
    .poll(async () => {
      const resources = await (
        await page.request.get(`/api/sources/resources?connection=${source.id}`)
      ).json();
      return resources.find((item: { id: string }) => item.id === resource.id)
        ?.state;
    })
    .toBe("AVAILABLE_TO_GROUP");
  await page.goto("/#/photos");
  await expect(page.locator(".mem-tile")).toHaveCount(9);
  const photo = page
    .getByRole("region", { name: "Ağustos 2025", exact: true })
    .locator(".mem-tile");
  await expect(photo).toBeVisible();
  const href = await photo.getAttribute("href");
  const memoryId = href!.slice("#/memory/".length).split("?")[0];
  const detail = await (
    await page.request.get(
      `/api/atlas/memory?group=${session.group_id}&memory=${memoryId}`,
    )
  ).json();
  const assetId = detail.memory.photos[0].assetId;
  expect(assetId).toBeTruthy();
  expect(
    (
      await page.request.post("/api/sources/withdraw", {
        data: { id: resource.id },
      })
    ).ok(),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Fotoğrafları yenile", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(8);
  await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
  const globe = await (
    await page.request.get(`/api/atlas?group=${session.group_id}`)
  ).json();
  expect(
    globe.memories.flatMap((memory: { photos: { assetId: string }[] }) =>
      memory.photos.map((photo) => photo.assetId),
    ),
  ).not.toContain(assetId);
  await page.goto(`/${href}`);
  await expect(
    page.getByRole("heading", { name: "Anı bulunamadı", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".viewer, .facts, .conversation")).toHaveCount(0);
  await page.goto("/#/photos");
  await expect(page.locator(".mem-tile")).toHaveCount(8);
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Fotoğrafları yenile", exact: true })
    .click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator(".mem-tile, .photo-month")).toHaveCount(0);
});
