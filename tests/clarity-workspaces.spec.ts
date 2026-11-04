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

test("named feature links land on their actual section and survive refresh failure", async ({
  page,
}) => {
  await page.route("**/api/memories/recap?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic recap unavailable" }),
    }),
  );
  const sections = [
    ["Hikâyeler", "stories", "Stories we share"],
    ["Yıllık özet", "recap", "Annual recap"],
    ["Zaman kapsülleri", "capsules", "Time capsules"],
  ];
  for (const [label, section, heading] of sections) {
    await page.goto("/#/explore");
    await page
      .getByRole("navigation", { name: "Keşfet araçları" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`#/memories\\?section=${section}$`),
    );
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeFocused();
    await expect(page.locator("#notice")).toContainText(
      "Synthetic recap unavailable",
    );
    const title = page.getByRole("textbox", {
      name: "Capsule title",
      exact: true,
    });
    await title.fill("Unsent synthetic draft");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pageshow"));
    });
    await expect(title).toBeFocused();
    await expect(title).toHaveValue("Unsent synthetic draft");
    await page
      .getByRole("button", { name: "Refresh stories", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Refresh stories", exact: true }),
    ).toBeFocused();
    await expect(page).toHaveURL(
      new RegExp(`#/memories\\?section=${section}$`),
    );
  }
});

test("People opens confirmed-association controls and retains its entry URL", async ({
  page,
}) => {
  await page.goto("/#/explore");
  await page
    .getByRole("navigation", { name: "Keşfet araçları" })
    .getByRole("link", { name: "Kişiler", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Fotoğraftaki kişiler",
      exact: true,
    }),
  ).toBeFocused();
  await expect(page).toHaveURL(/#\/discover\?section=people$/);
  await page.getByRole("textbox", { name: /^Person/ }).focus();
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.getByRole("textbox", { name: /^Person/ })).toBeFocused();
});

test("unknown section names keep the normal workspace available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/memories?section=toString");
  await expect(
    page.getByRole("heading", { name: "Memories", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#grid")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("a group refresh does not repeat the requested section focus", async ({
  page,
}) => {
  await page.goto("/#/memories?section=capsules");
  const heading = page.getByRole("heading", {
    name: "Time capsules",
    exact: true,
  });
  await expect(heading).toBeFocused();
  await page.locator("#capsule-title").focus();
  await page
    .locator(".feature-content")
    .evaluate((root) => root.setAttribute("data-previous-mount", "true"));
  await page.evaluate(() => window.dispatchEvent(new Event("mazi:group")));
  await expect(page.locator('[data-previous-mount="true"]')).toHaveCount(0);
  await expect(page.locator("#grid")).not.toBeEmpty();
  await expect(heading).not.toBeFocused();
  await expect(page).toHaveURL(/#\/memories\?section=capsules$/);
});

for (const prefix of ["/", "/#/"]) {
  test(`${prefix}people opens the confirmed people heading without an extra history entry`, async ({
    page,
  }) => {
    await page.goto("/#/explore");
    await page.goto(`${prefix}people`);
    await expect(page).toHaveURL(/#\/discover\?section=people$/);
    await expect(
      page.getByRole("heading", { name: "Fotoğraftaki kişiler", exact: true }),
    ).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/#\/explore$/);
  });
  test(`${prefix}settings opens the visible group settings and keeps Back usable`, async ({
    page,
  }) => {
    await page.goto("/#/explore");
    await page.goto(`${prefix}settings`);
    await expect(page).toHaveURL(/#\/circle\?section=settings$/);
    await expect(
      page.getByRole("heading", { name: "Grup ayarları", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("link", {
        name: "Hesap, yardım ve gizlilik",
        exact: true,
      }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/explore$/);
  });
}

test("source management has its own section, focus and parent destination", async ({
  page,
}) => {
  await page.goto("/#/circle");
  await page
    .getByRole("navigation", { name: "Grup araçları" })
    .getByRole("link", { name: "Kaynak bağlantıları", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/places\?section=sources$/);
  await expect(
    page.getByRole("heading", { name: "Kaynak bağlantıları", exact: true }),
  ).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Grubumuz", exact: true }),
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
    await expect(page.locator("#count")).toContainText("0 photographs");
    await expect(page.locator("#date-basis")).toHaveValue("");
    await page.locator("#date-basis").selectOption("shared");
    await page
      .getByRole("button", { name: "Search archive", exact: true })
      .click();
    await expect(page.locator("#results .disc-photo")).toHaveCount(1);
    await expect(page.locator("#results .disc-photo")).toContainText(
      "3 Şub 2024 · Paylaşıldı · UTC",
    );
    await expect(page.locator("#results .disc-photo")).toContainText(
      "Yer bilinmiyor",
    );
    await expect(page).toHaveURL(/date_basis=shared/);
    await page.locator("#date-basis").selectOption("chronology");
    await page
      .getByRole("button", { name: "Search archive", exact: true })
      .click();
    await expect(page.locator("#count")).toContainText("1 photographs");
    await page.reload();
    await expect(page.locator("#date-basis")).toHaveValue("chronology");
    await expect(page.locator("#results .disc-photo")).toHaveCount(1);
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== "running"),
    );
    const directory = "work/poteto/photo-search-corrections/screenshots";
    mkdirSync(directory, { recursive: true });
    await page.locator("#results .disc-photo").screenshot({
      path: `${directory}/${info.project.name}-sharing-result.png`,
    });
    await page
      .locator(".disc-refine")
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
      page.locator("#results .photo-label-badge", {
        hasText: "AI ile düzenlendi",
      }),
    ).toHaveCount(2);
    expect(
      requests.filter(
        (url) =>
          url.includes("/api/atlas") || url.includes("/api/discovery/people"),
      ),
    ).toEqual([]);
    await page.locator("#results").screenshot({
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
