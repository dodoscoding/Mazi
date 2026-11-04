import { test, expect, devices, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type Fixture = { group: string; event: string; assets: string[] };
async function enter(page: Page, name = "Alice"): Promise<Fixture> {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name, code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  return (await page.request.get("/__test__/state")).json();
}
async function open(
  page: Page,
  fixture: Fixture,
  discussion = "photo",
  photo = 0,
) {
  await page.goto(
    `/#/memory/${fixture.event}?photo=${photo}&discussion=${discussion}`,
  );
  await expect(
    page.getByRole("heading", {
      name: discussion === "photo" ? "Fotoğraf üzerine" : "Anı üzerine",
      exact: true,
    }),
  ).toBeFocused();
  return page.locator(".native-conversation");
}
async function post(page: Page, text: string) {
  await page.getByLabel("Yorum yaz", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Yorumu paylaş", exact: true })
    .click();
  await expect(page.locator(".native-comments")).toContainText(text);
}
async function selected(page: Page, fixture: Fixture, index = 0) {
  const archive = await (
    await page.request.get(`/api/atlas?group=${fixture.group}`)
  ).json();
  return archive.memories.find(
    (value: { id: string }) => value.id === fixture.event,
  ).photos[index].assetId as string;
}
async function create(
  page: Page,
  fixture: Fixture,
  target: { kind: string; id: string },
  text: string,
) {
  const response = await page.request.post("/api/social/comments/create", {
    data: {
      group: fixture.group,
      target,
      text,
      request_key: crypto.randomUUID(),
    },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/__test__/reset")).ok()).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("two sessions keep multiple photo messages separate from memory and sibling conversations", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "This case opens its own independent phone context.",
  );
  const fixture = await enter(page);
  const asset = await selected(page, fixture);
  await open(page, fixture);
  await post(page, "İlk fotoğraf sözü.");
  await post(page, "Aynı kişinin ikinci sözü.");
  await expect(page.locator(".native-comments article")).toHaveCount(2);
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 320, height: 760 },
  });
  const phone = await context.newPage();
  await enter(phone, "Ben");
  await phone.emulateMedia({ reducedMotion: "reduce" });
  await open(phone, fixture);
  await expect(phone.locator(".native-comments article")).toHaveCount(2);
  await expect(
    phone
      .locator(".native-comments")
      .getByRole("button", { name: "Düzenle", exact: true }),
  ).toHaveCount(0);
  const first = phone.locator(".native-comments article").first();
  await first
    .getByRole("button", { name: "Alice yorumu: Sevdim, 0", exact: true })
    .click();
  await expect(
    first.getByRole("button", { name: "Alice yorumu: Sevdim, 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await first.locator("summary").click();
  await expect(first).toContainText("Ben");
  await page.reload();
  await expect(
    page
      .locator(".native-comments article")
      .first()
      .getByRole("button", { name: "Alice yorumu: Sevdim, 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await phone.locator(".native-conversation").screenshot({
    path: "work/poteto/social-conversations-ui/photo-phone.png",
  });
  await first
    .getByRole("button", { name: "Alice yorumu: Sevdim, 1", exact: true })
    .click();
  await expect(
    first.getByRole("button", { name: "Alice yorumu: Sevdim, 0", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByLabel("Yorum yaz", { exact: true })
    .fill("Kardeş fotoğrafa taşınmamalı");
  await page.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(page).toHaveURL(/photo=1&discussion=photo/);
  await expect(page.locator(".native-comments article")).toHaveCount(0);
  await expect(page.getByLabel("Yorum yaz", { exact: true })).toHaveValue("");
  await post(page, "İkinci fotoğrafa ait.");
  await open(page, fixture, "memory");
  await expect(page.locator(".native-comments article")).toHaveCount(0);
  await post(page, "Anının bütününe ait.");
  await expect(page.locator(".event-notebook")).not.toContainText(
    "Anının bütününe ait.",
  );
  await page.locator(".native-conversation").screenshot({
    path: "work/poteto/social-conversations-ui/memory-desktop.png",
  });
  const original = await (
    await page.request.get(
      `/api/social/comments?${new URLSearchParams({ group: fixture.group, kind: "photo", target: asset })}`,
    )
  ).json();
  expect(original.items.map((item: { text: string }) => item.text)).toEqual([
    "İlk fotoğraf sözü.",
    "Aynı kişinin ikinci sözü.",
  ]);
  await context.close();
});

test("lost comment responses retry exact keys and stale edits retain drafts", async ({
  page,
}) => {
  const fixture = await enter(page);
  await open(page, fixture);
  const bodies: unknown[] = [];
  let dropped = false;
  await page.route("**/api/social/comments/create", async (route) => {
    bodies.push(route.request().postDataJSON());
    if (!dropped) {
      dropped = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page
    .getByLabel("Yorum yaz", { exact: true })
    .fill("Yanıtı kaybolan yorum");
  await page
    .getByRole("button", { name: "Yorumu paylaş", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Aynı işlemi yeniden dene" }),
  ).toBeVisible();
  await expect(page.getByLabel("Yorum yaz", { exact: true })).toHaveValue(
    "Yanıtı kaybolan yorum",
  );
  await page.getByRole("button", { name: "Aynı işlemi yeniden dene" }).click();
  await expect(page.locator(".native-comments article")).toHaveCount(1);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page
    .getByLabel("Yorumunu düzenle", { exact: true })
    .fill("Benim saklanan taslağım");
  const asset = await selected(page, fixture);
  const { items } = await (
    await page.request.get(
      `/api/social/comments?${new URLSearchParams({ group: fixture.group, kind: "photo", target: asset })}`,
    )
  ).json();
  expect(
    (
      await page.request.post("/api/social/comments/update", {
        data: {
          group: fixture.group,
          comment: items[0].id,
          revision: 1,
          text: "Başka sekme",
          request_key: crypto.randomUUID(),
        },
      })
    ).ok(),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Değişikliği kaydet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Güncel yorumları yükle", exact: true })
    .click();
  await expect(
    page.getByLabel("Yorumunu düzenle", { exact: true }),
  ).toHaveValue("Benim saklanan taslağım");
  await expect(page.locator(".native-comments")).toContainText("Başka sekme");
  await page
    .getByRole("button", { name: "Değişikliği kaydet", exact: true })
    .click();
  await expect(page.locator(".native-comments")).toContainText(
    "Benim saklanan taslağım",
  );
});

test("deletion removes reactions and source withdrawal clears the panel", async ({
  page,
}) => {
  const fixture = await enter(page);
  await open(page, fixture);
  await post(page, "Silinecek söz");
  await page
    .locator(".native-comments")
    .getByRole("button", { name: "Alice yorumu: Beğendim, 0", exact: true })
    .click();
  await expect(
    page
      .locator(".native-comments")
      .getByRole("button", { name: "Alice yorumu: Beğendim, 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sil", exact: true }).click();
  await page.getByRole("button", { name: "Yorumu sil", exact: true }).click();
  await expect(page.locator(".native-comments article")).toHaveCount(0);
  await expect(page.locator(".conversation-total")).toHaveText("0 yorum");
  await post(page, "Kaynak çekilince gizlenecek");
  await page.getByLabel("Yorum yaz", { exact: true }).fill("Özel taslak");
  expect((await page.request.post("/__test__/withdraw")).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator(".native-conversation")).toContainText(
    "Bu sohbet kullanılamıyor",
  );
  await expect(page.locator(".native-comments article")).toHaveCount(0);
  await expect(page.locator(".native-conversation [aria-pressed]")).toHaveCount(
    0,
  );
  await expect(page.locator(".native-conversation textarea")).toHaveCount(0);
});

test("pagination batches only the visible page and works at 320 pixels with keyboard and axe", async ({
  page,
}, info) => {
  const fixture = await enter(page);
  const asset = await selected(page, fixture);
  for (let index = 0; index < 22; index++)
    await create(page, fixture, { kind: "photo", id: asset }, `Söz ${index}`);
  const batches: number[] = [];
  const singles: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/social/reactions/batch")
      batches.push(JSON.parse(url.searchParams.get("targets")!).length);
    if (url.pathname === "/api/social/reactions") singles.push(url.pathname);
  });
  await page.setViewportSize({ width: 320, height: 760 });
  await open(page, fixture);
  await expect(page.locator(".native-comments article")).toHaveCount(20);
  await page
    .getByRole("button", { name: "Sonraki yorumlar", exact: true })
    .click();
  await expect(page.locator(".native-comments article")).toHaveCount(2);
  expect(batches).toEqual([21, 3]);
  expect(singles).toEqual([]);
  const reaction = page.getByRole("button", {
    name: "Fotoğraf: Beğendim, 0",
    exact: true,
  });
  await reaction.focus();
  await page.keyboard.press("Space");
  const enabled = page.getByRole("button", {
    name: "Fotoğraf: Beğendim, 1",
    exact: true,
  });
  await expect(enabled).toHaveAttribute("aria-pressed", "true");
  await expect(enabled).toBeFocused();
  await page.getByLabel("Yorum yaz", { exact: true }).focus();
  await page.keyboard.type("Klavye ile");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Yorumu paylaş", exact: true }),
  ).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).include(".native-conversation").analyze())
      .violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "phone")
    await page.locator(".native-conversation").screenshot({
      path: "work/poteto/social-conversations-ui/page-phone.png",
    });
  await page.getByRole("button", { name: "İlk yorumlar", exact: true }).click();
  await expect(page.locator(".native-comments article")).toHaveCount(20);
});

test("session disposal ignores a committed write's late result", async ({
  page,
}) => {
  const fixture = await enter(page);
  await open(page, fixture);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let committed!: () => void;
  const done = new Promise<void>((resolve) => {
    committed = resolve;
  });
  await page.route("**/api/social/comments/create", async (route) => {
    const response = await route.fetch();
    committed();
    await gate;
    await route.fulfill({ response });
  });
  await page
    .getByLabel("Yorum yaz", { exact: true })
    .fill("Geç yanıt özel metni");
  await page
    .getByRole("button", { name: "Yorumu paylaş", exact: true })
    .click();
  await done;
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("mazi:session")));
  release();
  await expect(page.locator(".native-conversation textarea")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Geç yanıt özel metni");
  await expect(page.locator(".native-conversation [aria-pressed]")).toHaveCount(
    0,
  );
});

test("uncertain reactions replay the same desired state and can then be turned off", async ({
  page,
}) => {
  const fixture = await enter(page);
  await open(page, fixture);
  let dropped = false;
  const writes: { active: boolean; request_key: string }[] = [];
  await page.route("**/api/social/reactions/set", async (route) => {
    writes.push(route.request().postDataJSON());
    if (!dropped) {
      dropped = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Fotoğraf: Sevdim, 0", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aynı işlemi yeniden dene", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fotoğraf: Sevdim, 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  expect(writes[0].active).toBe(true);
  await page
    .getByRole("button", { name: "Fotoğraf: Sevdim, 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fotoğraf: Sevdim, 0", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(writes[2].active).toBe(false);
});

test("configured-circle replacement clears the draft and denies old-target reads and writes", async ({
  page,
}) => {
  const fixture = await enter(page);
  const asset = await selected(page, fixture);
  await open(page, fixture);
  await post(page, "Eski grubun özel sözü");
  await page
    .getByLabel("Yorum yaz", { exact: true })
    .fill("Taşınmaması gereken taslak");
  expect((await page.request.post("/__test__/switch-circle")).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("mazi:group")));
  await expect(page.locator(".native-conversation textarea")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Eski grubun özel sözü");
  expect(
    (
      await page.request.get(
        `/api/social/comments?${new URLSearchParams({ group: fixture.group, kind: "photo", target: asset })}`,
      )
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/social/comments/create", {
        data: {
          group: fixture.group,
          target: { kind: "photo", id: asset },
          text: "Yanlış grup",
          request_key: crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(403);
});
