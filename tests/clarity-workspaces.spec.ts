import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";

test.beforeEach(async ({ page }) => {
  const response = await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  expect(response.ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("historical story and capsule links reach Past creations without authoring", async ({
  page,
}) => {
  for (const section of ["stories", "capsules"]) {
    await page.goto(`/#/memories?section=${section}`);
    await expect(page).toHaveURL(/#\/past-creations$/);
    await expect(
      page.getByRole("heading", { name: "Past creations", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByText("No Past creations are currently available.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
  }
});

test("old People links reach their retained Settings home without unrelated records", async ({
  page,
}) => {
  await page.goto("/#/discover?section=people&person=unknown");
  await expect(
    page.getByRole("heading", {
      name: "Settings",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/settings\?/);
  await expect(page.locator(".viewer")).toHaveCount(0);
});

test("unknown section names keep the normal workspace available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/memories?section=toString");
  await expect(
    page.getByRole("heading", { name: "Fotoğraflar", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#grid")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("old recap year links open the ordinary year in Photos without authoring", async ({
  page,
}) => {
  await page.goto("/#/memories?section=recap&year=2024");
  await expect(page).toHaveURL(/recap=2024/);
  await expect(
    page.getByRole("heading", { name: "Annual recap 2024", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#recap-scope")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start a story", exact: true }),
  ).toHaveCount(0);
});

for (const prefix of ["/", "/#/"]) {
  test(`${prefix}people preserves Back and reaches Settings people`, async ({
    page,
  }) => {
    await page.goto("/#/photos");
    await page.goto(`${prefix}people`);
    await expect(page).toHaveURL(/#\/settings\?section=people$/);
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/photos$/);
  });
  test(`${prefix}settings opens account and membership controls and keeps Back usable`, async ({
    page,
  }) => {
    await page.goto("/#/explore");
    await page.goto(`${prefix}settings`);
    await expect(page).toHaveURL(/(?:#\/|\/)settings$/);
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("link", {
        name: "Replay introduction",
        exact: true,
      }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/photos$/);
  });
}

test("source management has its own section, focus and parent destination", async ({
  page,
}) => {
  await page.goto("/#/places?section=sources");
  await expect(page).toHaveURL(/#\/add\?section=sources$/);
  await expect(
    page.getByRole("heading", { name: "Kaynak bağlantıları", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .filter({ visible: true })
      .first()
      .getByRole("link", { name: "Add", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .locator('#source-form input[name="label"]')
    .fill("Unsent source draft");
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator('#source-form input[name="label"]')).toHaveValue(
    "Unsent source draft",
  );
  await expect(
    page.getByRole("heading", { name: "Kaynak bağlantıları", exact: true }),
  ).not.toBeFocused();
});

test("date bases find an imported sharing-only photo while old bookmarks retain capture", async ({
  page,
}, info) => {
  const profile = await (await page.request.get("/api/session")).json();
  const filename = `a2-sharing-${info.project.name}.jpg`;
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(11,9),(220,35,160)).save(p,'JPEG'); a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); z.writestr(sys.argv[1],p.getvalue()); z.writestr('messages/c1/messages.csv','ID,Timestamp,Contents,Attachments\\n987,2024-02-03T00:30:00+00:00,Synthetic sharing-only photo,'+sys.argv[1]+'\\n'); z.close(); sys.stdout.buffer.write(a.getvalue())",
    filename,
  ]);
  const started = await page.request.post("/api/imports/start", {
    data: {
      group: profile.group_id,
      source: "discord",
      namespace: `a2-read-${info.project.name}`,
      size: fixture.length,
      sha256: createHash("sha256").update(fixture).digest("hex"),
      options: {},
    },
  });
  expect(started.ok()).toBe(true);
  const { id } = await started.json();
  try {
    expect(
      (
        await page.request.post("/api/imports/chunk", {
          data: { id, offset: 0, data: fixture.toString("base64") },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await page.request.post("/api/imports/finish", { data: { id } })).ok(),
    ).toBe(true);
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/imports/${id}`)).json()).state,
      )
      .toBe("INVENTORIED");
    expect(
      (await page.request.post("/api/imports/confirm", { data: { id } })).ok(),
    ).toBe(true);
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`/api/imports/${id}`)).json()).state,
      )
      .toBe("COMPLETED");
    await page.goto(
      `/#/search?q=${filename}&from=2024-02-03&through=2024-02-03`,
    );
    await expect(page.locator("#grid-summary")).toContainText(
      "0 eşleşen fotoğraf",
    );
    await page.locator("#filters-open").click();
    await expect(page.locator('[name="date_basis"]')).toHaveValue("");
    await page.locator('[name="date_basis"]').selectOption("shared");
    await page
      .locator(".photo-date-filters")
      .evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(page.locator(".mem-tile")).toHaveCount(1);
    await expect(page.locator(".mem-tile")).toContainText(
      "3 Şub 2024 · Paylaşıldı · UTC",
    );
    await expect(page.locator(".mem-tile")).toContainText("Yer bilinmiyor");
    await expect(page).toHaveURL(/date_basis=shared/);
    await page.locator('[name="date_basis"]').selectOption("chronology");
    await page
      .locator(".photo-date-filters")
      .evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(page.locator("#grid-summary")).toContainText(
      "1 eşleşen fotoğraf",
    );
    await page.reload();
    await expect(page.locator('[name="date_basis"]')).toHaveValue("chronology");
    await expect(page.locator(".mem-tile")).toHaveCount(1);
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== "running"),
    );
    const directory = "work/poteto/photo-search-corrections/screenshots";
    mkdirSync(directory, { recursive: true });
    await page.locator(".mem-tile").screenshot({
      path: `${directory}/${info.project.name}-sharing-result.png`,
    });
    await page.locator("#filters-open").click();
    await page
      .locator("#memory-filters")
      .screenshot({ path: `${directory}/${info.project.name}-date-basis.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    expect(
      (await page.request.post("/api/imports/withdraw", { data: { id } })).ok(),
    ).toBe(true);
  }
});

test("selected child corrections refresh facts and leave its sibling untouched", async ({
  page,
}, info) => {
  const profile = await (await page.request.get("/api/session")).json();
  const group = profile.group_id;
  const atlas = await (
    await page.request.get(`/api/atlas?group=${group}`)
  ).json();
  const memory = atlas.memories.find(
    (item: { photos: unknown[] }) => item.photos.length > 1,
  );
  expect(memory).toBeTruthy();
  const asset = memory.photos[0].assetId;
  const sibling = memory.photos[1].assetId;
  const read = async (id: string) =>
    (
      await page.request.get(`/api/atlas/photo?group=${group}&asset=${id}`)
    ).json();
  const before = await read(asset);
  const siblingBefore = await read(sibling);
  try {
    await page.goto(`/#/memory/${memory.id}?photo=0`);
    await page
      .getByRole("button", { name: "Yeri değiştir", exact: true })
      .click();
    const editor = page.getByRole("form", { name: "Seçili fotoğrafı düzelt" });
    await expect(editor.getByLabel("Yer", { exact: true })).toHaveValue(
      before.annotation.place,
    );
    await editor
      .getByLabel("Yer", { exact: true })
      .fill("Synthetic garden beside the lake");
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.locator(".viewer-caption-text")).toContainText(
      "Synthetic garden beside the lake",
    );
    expect((await read(sibling)).annotation).toEqual(siblingBefore.annotation);
    await page
      .getByRole("button", { name: "Tarihi düzelt", exact: true })
      .click();
    await editor.getByLabel("Çekim tarihi", { exact: true }).fill("2023-05-06");
    await editor.getByRole("button", { name: "Kaydet", exact: true }).click();
    await expect(page.locator(".viewer-caption-text")).toContainText(
      "6 May 2023",
    );
    const directory = "work/poteto/photo-corrections-ui";
    mkdirSync(directory, { recursive: true });
    await page.locator(".detail-body").screenshot({
      path: `${directory}/${info.project.name}-selected-photo.png`,
    });
    await page.goto(`/#/memory/${memory.id}?photo=1`);
    await expect(page.locator(".viewer-caption-text")).not.toContainText(
      "Synthetic garden",
    );
    await expect(page.locator(".viewer-caption-text")).toContainText(
      "2 Oca 2024",
    );
    expect((await read(sibling)).annotation).toEqual(siblingBefore.annotation);
    await page.goto(`/#/memory/${memory.id}?photo=0`);
    await page
      .getByRole("button", { name: "Yeri değiştir", exact: true })
      .click();
    await expect(editor.getByLabel("Yer", { exact: true })).toHaveValue(
      "Synthetic garden beside the lake",
    );
    await editor.getByRole("button", { name: "Temizle", exact: true }).click();
    await expect
      .poll(async () => (await read(asset)).annotation.place)
      .toBe("");
    await expect(page.locator(".viewer-caption-text")).not.toContainText(
      "Synthetic garden",
    );
  } finally {
    const current = await read(asset);
    await page.request.post("/api/atlas/photo", {
      data: {
        group,
        asset,
        expected_snapshot: current.snapshot,
        changes: {
          capture_date: before.annotation.capture_date,
          place: before.annotation.place,
        },
      },
    });
  }
});

test("photo label editing and atomic Gallery selection show honest badges at phone width", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  const profile = await (await page.request.get("/api/session")).json();
  const group = profile.group_id;
  const atlas = await (
    await page.request.get(`/api/atlas?group=${group}`)
  ).json();
  const memory = atlas.memories.find(
    (item: { photos: unknown[] }) => item.photos.length > 2,
  );
  const assets: string[] = memory.photos.map(
    (photo: { assetId: string }) => photo.assetId,
  );
  const read = async () =>
    (
      await page.request.get(
        "/api/social/labels?" +
          new URLSearchParams({ group, assets: JSON.stringify(assets) }),
      )
    ).json();
  const before = await read();
  const directory = "work/poteto/photo-labels-ui";
  mkdirSync(directory, { recursive: true });
  try {
    await page.goto(`/#/memory/${memory.id}?photo=0`);
    await page
      .getByRole("button", { name: "Etiketleri düzenle", exact: true })
      .click();
    const editor = page.getByRole("form", {
      name: "Fotoğraf etiketlerini düzenle",
    });
    await expect(editor).toContainText("Beyan: Bilinmiyor");
    await expect(editor).toContainText("onaylı kişi etiketlerinden");
    await editor
      .getByLabel("Ekran görüntüsü", { exact: true })
      .selectOption("yes");
    await editor
      .getByLabel("AI kullanımı", { exact: true })
      .selectOption("generated");
    await editor
      .getByRole("button", { name: "Etiketleri kaydet", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    const afterSingle = await read();
    expect(afterSingle.items[1]).toEqual(before.items[1]);
    expect(afterSingle.items[0].labels.screenshot.value).toBe("yes");
    await page.goto("/#/memories");
    await expect(
      page.locator(".photo-label-badge", { hasText: "Ekran görüntüsü" }),
    ).toHaveCount(1);
    await expect(
      page.locator(".photo-label-badge", { hasText: "AI üretimi" }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Fotoğraf seç", exact: true })
      .click();
    for (const asset of assets.slice(0, 2))
      await page.locator(`.mem-photo-select input[value="${asset}"]`).check();
    await page
      .getByRole("button", { name: "Seçili etiketleri düzenle", exact: true })
      .click();
    await expect(editor).toContainText("2 fotoğrafın etiketleri");
    await editor
      .getByLabel("AI kullanımı", { exact: true })
      .selectOption("edited");
    await editor.screenshot({
      animations: "disabled",
      path: `${directory}/${info.project.name}-bulk-editor.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await editor
      .getByRole("button", { name: "Etiketleri kaydet", exact: true })
      .click();
    await expect(
      page.locator(".photo-label-badge", { hasText: "AI ile düzenlendi" }),
    ).toHaveCount(2);
    expect((await read()).items[2]).toEqual(before.items[2]);
    await page.locator("#grid").screenshot({
      animations: "disabled",
      path: `${directory}/${info.project.name}-gallery-badges.png`,
    });
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/#/search");
    await expect(
      page.locator("#grid .photo-label-badge", {
        hasText: "AI ile düzenlendi",
      }),
    ).toHaveCount(2);
    expect(
      requests.filter((url) => url.includes("/api/discovery/people")),
    ).toEqual([]);
    await page.locator("#grid").screenshot({
      animations: "disabled",
      path: `${directory}/${info.project.name}-search-badges.png`,
    });
  } finally {
    const current = await read();
    await page.request.post("/api/social/labels/set", {
      data: {
        group,
        request_key: `restore-labels-${info.project.name}-${Date.now()}`,
        items: current.items.map(
          (
            item: {
              assetId: string;
              labels: Record<string, { revision: number }>;
            },
            index: number,
          ) => ({
            asset: item.assetId,
            changes: Object.fromEntries(
              Object.entries(before.items[index].labels).map(
                ([dimension, value]) => [
                  dimension,
                  (value as { declared: string }).declared,
                ],
              ),
            ),
            expected: Object.fromEntries(
              Object.entries(item.labels).map(([dimension, value]) => [
                dimension,
                value.revision,
              ]),
            ),
          }),
        ),
      },
    });
  }
});

test("same-photo filters survive reload and keep original child links at narrow width", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  const profile = await (await page.request.get("/api/session")).json();
  const group = profile.group_id;
  const visible = await (
    await page.request.get(`/api/discovery/matches?group=${group}`)
  ).json();
  expect(visible.total).toBeGreaterThanOrEqual(3);
  const atlas = await (
    await page.request.get(`/api/atlas?group=${group}`)
  ).json();
  const memory = atlas.memories.find(
    (item: { photos: unknown[] }) => item.photos.length > 2,
  );
  const assets: string[] = memory.photos.map(
    (photo: { assetId: string }) => photo.assetId,
  );
  const target = assets[2],
    screenshot = assets[1];
  const before = await (
    await page.request.get(
      "/api/social/labels?" +
        new URLSearchParams({ group, assets: JSON.stringify(assets) }),
    )
  ).json();
  const personResponse = await page.request.post("/api/discovery/person", {
    data: { group, name: `Sentetik kişi ${info.project.name}` },
  });
  expect(personResponse.ok()).toBe(true);
  const { id: person } = await personResponse.json();
  expect(
    (
      await page.request.post("/api/discovery/tag", {
        data: { person, asset: target, confirmed: true },
      })
    ).ok(),
  ).toBe(true);
  const directory = "work/poteto/photo-filters";
  mkdirSync(directory, { recursive: true });
  const query = new URLSearchParams({
    person,
    screenshot: "yes",
    ai: "generated,edited",
    source: "apple",
    by: "Alice",
    from: "2024-01-02",
    through: "2024-01-02",
    date_basis: "chronology",
    mode: "keyword",
  });
  try {
    expect(
      (
        await page.request.post("/api/social/labels/set", {
          data: {
            group,
            request_key: `filter-setup-${info.project.name}-${Date.now()}`,
            items: before.items.map(
              (item: {
                assetId: string;
                labels: Record<string, { revision: number }>;
              }) => ({
                asset: item.assetId,
                changes: {
                  screenshot: item.assetId === screenshot ? "yes" : "unknown",
                  ai:
                    item.assetId === target || item.assetId === screenshot
                      ? "generated"
                      : "unknown",
                },
                expected: {
                  screenshot: item.labels.screenshot.revision,
                  ai: item.labels.ai.revision,
                },
              }),
            ),
          },
        })
      ).ok(),
    ).toBe(true);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/#/search?" + query);
    await expect(page.locator("#grid-summary")).toContainText(
      "0 eşleşen fotoğraf",
    );
    await expect(page.locator(".photo-filters")).toContainText(
      `görünür ${visible.total} fotoğrafın tamamı`,
    );

    expect(requests.some((url) => url.includes("/api/discovery/state"))).toBe(
      false,
    );
    await page.locator("#filters-open").click();
    await page
      .getByRole("button", { name: "Ekran görüntüsü: Evet ×", exact: true })
      .click();
    await expect(page.locator("#grid-summary")).toContainText(
      "1 eşleşen fotoğraf",
    );
    await page.reload();
    await expect(page.locator("#grid-summary")).toContainText(
      "1 eşleşen fotoğraf",
    );

    await page.locator("#grid").screenshot({
      animations: "disabled",
      path: `${directory}/${info.project.name}-search-filtered.png`,
    });
    await page.goto("/#/memories?" + query);
    await expect(
      page.getByRole("heading", {
        name: "Bu filtrelerle eşleşen fotoğraf yok",
        exact: true,
      }),
    ).toBeVisible();
    await page.locator("#filters-open").click();
    await page
      .getByRole("button", { name: "Ekran görüntüsü: Evet ×", exact: true })
      .click();
    await expect(page.locator("#grid-summary")).toContainText(
      "1 eşleşen fotoğraf",
    );
    await page.locator("#filters-apply").click();
    await expect(page.locator(".mem-tile")).toHaveCount(1);
    await expect(page.locator(".mem-tile")).toHaveAttribute(
      "href",
      `#/memory/${memory.id}?photo=2`,
    );
    await page.reload();
    await expect(page.locator(".mem-tile")).toHaveCount(1);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .locator("#grid")
      .evaluate((node) =>
        node.scrollIntoView({ block: "center", behavior: "instant" }),
      );
    await page.locator("#grid").screenshot({
      animations: "disabled",
      path: `${directory}/${info.project.name}-gallery-filtered.png`,
    });
    expect(
      (
        await page.request.post("/api/discovery/hide", {
          data: { asset: target, enabled: true },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await expect(page.locator("#grid-summary")).toContainText(
      "0 eşleşen fotoğraf",
    );
    await expect(page.locator(".mem-tile")).toHaveCount(0);
  } finally {
    await page.request.post("/api/discovery/hide", {
      data: { asset: target, enabled: false },
    });
    await page.request.post("/api/discovery/untag", {
      data: { person, asset: target },
    });
    const current = await (
      await page.request.get(
        "/api/social/labels?" +
          new URLSearchParams({ group, assets: JSON.stringify(assets) }),
      )
    ).json();
    await page.request.post("/api/social/labels/set", {
      data: {
        group,
        request_key: `filter-restore-${info.project.name}-${Date.now()}`,
        items: current.items.map(
          (
            item: {
              assetId: string;
              labels: Record<string, { revision: number }>;
            },
            index: number,
          ) => ({
            asset: item.assetId,
            changes: {
              screenshot: before.items[index].labels.screenshot.declared,
              ai: before.items[index].labels.ai.declared,
            },
            expected: {
              screenshot: item.labels.screenshot.revision,
              ai: item.labels.ai.revision,
            },
          }),
        ),
      },
    });
  }
});

test("Gallery presentation controls retain failed matching authority until retry succeeds", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  const profile = await (await page.request.get("/api/session")).json();
  const visible = await (
    await page.request.get(`/api/discovery/matches?group=${profile.group_id}`)
  ).json();
  expect(visible.total).toBeGreaterThanOrEqual(3);
  await page.goto("/#/memories");
  await expect(page.locator(".mem-tile")).toHaveCount(visible.total);
  let failed = false;
  await page.route("**/api/discovery/matches?**", (route) => {
    if (failed) return route.continue();
    failed = true;
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Synthetic capacity failure",
        code: "capacity_exceeded",
      }),
    });
  });
  await page.locator("#filters-open").click();
  await page
    .getByRole("group", { name: "Ekran görüntüsü", exact: true })
    .getByRole("checkbox", { name: /^Evet/ })
    .check();
  await expect(page.locator("#grid-summary")).toHaveText(
    "Eşleşmeler yüklenemedi.",
  );
  await page.locator("#filters-apply").click();
  for (const control of [
    page.getByRole("button", { name: "Fotoğraf seç", exact: true }),
  ]) {
    await control.click();
    await expect(page.locator("#grid-summary")).toHaveText(
      "Eşleşmeler yüklenemedi.",
    );
    await expect(
      page
        .locator("#grid")
        .getByRole("button", { name: "Yeniden dene", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".mem-tile")).toHaveCount(0);
    await expect(page.locator("#grid .mem-empty")).toHaveCount(0);
  }
  await page
    .locator("#grid")
    .getByRole("button", { name: "Yeniden dene", exact: true })
    .click();
  await expect(page.locator("#grid-summary")).toHaveText(
    `0 eşleşen fotoğraf · ${visible.total} görünür fotoğraf`,
  );
  await expect(
    page.getByRole("heading", {
      name: "Bu filtrelerle eşleşen fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/screenshot=yes/);
});
