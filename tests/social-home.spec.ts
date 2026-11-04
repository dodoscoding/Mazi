import { test, expect, devices, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
async function enter(page: Page, name = "Alice") {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name, code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
}
async function fixture(page: Page) {
  return (await page.request.get("/__test__/state")).json();
}
async function home(page: Page) {
  await page.goto("/#/");
  await expect(
    page.getByRole("heading", { name: "Birlikte hatırlayalım", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".home-landing [role=status]")).toHaveCount(0);
}
async function upload(page: Page) {
  const buffer = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; a=io.BytesIO(); z=zipfile.ZipFile(a,'w'); [(lambda p,c: (Image.new('RGB',(83,61),c).save(p,'JPEG'), z.writestr('home-'+c+'.jpg',p.getvalue())))(io.BytesIO(),c) for c in ['purple','orange']]; z.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  await page.goto("/#/imports");
  await page.locator('#upload select[name="source"]').selectOption("manual");
  await page.getByLabel("Source account label").fill("synthetic Home account");
  await page
    .getByLabel("Export ZIP")
    .setInputFiles({ name: "home.zip", mimeType: "application/zip", buffer });
  await page
    .getByRole("button", { name: "Upload and inspect inventory", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("inventoried");
  await page
    .getByRole("button", { name: "Start importing to group", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("completed", {
    timeout: 30000,
  });
  const asset = (await fixture(page)).assets[0] as string;
  expect(
    (
      await page.request.post("/api/review/correct", {
        data: {
          asset,
          title: "Kıyıda bir gün",
          capture_date: "2020-01-02",
          place: "",
        },
      })
    ).ok(),
  ).toBe(true);
  return asset;
}
async function comment(page: Page, text: string) {
  await page.getByLabel("Yorum yaz", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "Yorumu paylaş", exact: true })
    .click();
  await expect(page.locator(".native-comments")).toContainText(text);
}
function observe(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  return requests;
}
test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/__test__/reset")).ok()).toBe(true);
  await enter(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("two sessions go from an empty Home through planning, a real photo upload, conversation and next-day return", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "This case explicitly opens an independent 320px phone session.",
  );
  const requests = observe(page);
  await home(page);
  expect((await fixture(page)).photos).toBe(0);
  expect(
    requests.filter(
      (path) => path === "/api/atlas" || path === "/api/memories/notebook",
    ),
  ).toEqual([]);
  await expect(
    page.getByRole("heading", { name: "İlk buluşmamızı planlayalım" }),
  ).toBeVisible();
  await page.screenshot({
    path: "work/poteto/social-home-ui/empty-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Buluşma planla", exact: true }).click();
  await page.getByLabel("Başlık", { exact: true }).fill("Bu akşam birlikte");
  await page.getByLabel("Saat dilimi", { exact: true }).fill("UTC");
  await page
    .getByLabel("Başlangıç", { exact: true })
    .fill(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  await page
    .getByRole("button", { name: "Buluşmayı oluştur", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bu akşam birlikte", exact: true }),
  ).toBeVisible();
  await home(page);
  await expect(page.locator(".home-plan")).toContainText("Bu akşam birlikte");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  await page.screenshot({
    path: "work/poteto/social-home-ui/plan-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 320, height: 760 },
    timezoneId: "America/New_York",
  });
  const phone = await context.newPage();
  await enter(phone, "Ben");
  await phone.emulateMedia({ reducedMotion: "reduce" });
  await home(phone);
  await phone.getByRole("link", { name: "Planı aç", exact: true }).click();
  await phone.getByRole("button", { name: /^Geliyorum/ }).click();
  await expect(phone.locator(".plan-detail")).toContainText("Ben");
  await home(phone);
  await expect(phone.locator(".home-plan")).toContainText("1 kişi geliyor");
  await expect(phone.locator(".home-plan")).toContainText("UTC");
  const asset = await upload(page);
  const { group } = await fixture(page);
  const approved = await page.request.post("/api/review/event", {
    data: {
      group,
      assets: (await fixture(page)).assets,
      title: "Birlikte bir gün",
      decision: "accept",
    },
  });
  expect(approved.ok()).toBe(true);
  const event = (await approved.json()).id;
  const before = requests.length;
  await page.goto(`/#/memory/photo-${asset}?discussion=photo`);
  await expect(
    page.getByRole("heading", { name: "Fotoğraf üzerine", exact: true }),
  ).toBeFocused();
  expect(
    requests
      .slice(before)
      .filter(
        (path) => path === "/api/atlas" || path === "/api/memories/notebook",
      ),
  ).toEqual([]);
  await comment(page, "İlk yeni sözümüz");
  await comment(page, "İkinci yeni sözümüz");
  await phone.goto(`/#/memory/photo-${asset}?discussion=photo`);
  await expect(phone.locator(".native-comments article")).toHaveCount(2);
  await phone
    .locator(".native-comments article")
    .first()
    .getByRole("button", { name: "Alice yorumu: Sevdim, 0", exact: true })
    .click();
  await expect(
    phone
      .locator(".native-comments article")
      .first()
      .getByRole("button", { name: "Alice yorumu: Sevdim, 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await home(page);
  await expect(page.locator(".home-plan")).toBeVisible();
  expect((await page.request.post("/__test__/next-day")).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.locator(".home-featured")).toContainText(
    "İkinci yeni sözümüz",
  );
  await expect(page.locator(".home-featured .memory-meta")).toContainText(
    "2020",
  );
  await expect(page.locator(".home-featured time")).not.toContainText("2020");
  await expect(
    page.getByRole("link", { name: "Sohbeti aç", exact: true }),
  ).toHaveAttribute("href", `#/memory/photo-${asset}?discussion=photo`);
  await page.screenshot({
    path: "work/poteto/social-home-ui/next-day-desktop.png",
    fullPage: true,
  });
  await home(phone);
  await phone.screenshot({
    path: "work/poteto/social-home-ui/next-day-phone.png",
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page: phone }).include(".home-landing").analyze())
      .violations,
  ).toEqual([]);
  expect(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await phone.getByRole("link", { name: "Sohbeti aç", exact: true }).click();
  await expect(phone.locator(".native-comments article")).toHaveCount(2);
  await page.goto(`/#/memory/${event}?notebook=1`);
  await expect(page.locator("#notebook-heading")).toBeFocused();
  const timings = (await fixture(page)).timings;
  console.log("SYNTHETIC_QUERY_TIMINGS", JSON.stringify(timings));
  await context.close();
});

test("photo-only Home fallback opens one selected photo and activity stays bounded and paged", async ({
  page,
}, info) => {
  const asset = await upload(page);
  const { group } = await fixture(page);
  const requests = observe(page);
  await home(page);
  await expect(page.locator(".home-featured")).toBeVisible();
  expect(
    requests.filter(
      (path) => path === "/api/atlas" || path === "/api/memories/notebook",
    ),
  ).toEqual([]);
  const selectedLink = page.getByRole("link", {
    name: "Anıyı aç",
    exact: true,
  });
  const href = await selectedLink.getAttribute("href");
  expect(
    (await fixture(page)).assets.map((id: string) => `#/memory/photo-${id}`),
  ).toContain(href);
  await selectedLink.click();
  expect(new URL(page.url()).hash).toBe(href);
  await expect(page.locator(".memory-detail")).toBeVisible();
  expect(requests.filter((path) => path === "/api/atlas")).toEqual([]);
  await page.locator(".back-pill").click();
  await expect(selectedLink).toBeFocused();
  for (let index = 0; index < 22; index++)
    expect(
      (
        await page.request.post("/api/social/comments/create", {
          data: {
            group,
            target: { kind: "photo", id: asset },
            text: `Haber ${index}`,
            request_key: crypto.randomUUID(),
          },
        })
      ).ok(),
    ).toBe(true);
  await page.goto("/#/circle?section=activity");
  await expect(
    page.getByRole("heading", { name: "Grubumuzdan haberler", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".social-activity li")).toHaveCount(20);
  await page
    .getByRole("button", { name: "Sonraki haberler", exact: true })
    .click();
  await expect(page.locator(".social-activity li")).toHaveCount(2);
  await page.getByRole("button", { name: "İlk haberler", exact: true }).click();
  await expect(page.locator(".social-activity li")).toHaveCount(20);
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 760 });
    await page.screenshot({
      path: "work/poteto/social-home-ui/activity-phone.png",
      fullPage: true,
    });
  }
  expect(
    (await new AxeBuilder({ page }).include(".home-landing").analyze())
      .violations,
  ).toEqual([]);
});

test("Home and selected detail recover from read errors and clear withdrawn content", async ({
  page,
}) => {
  const asset = await upload(page);
  let fail = true;
  await page.route("**/api/social/home?*", async (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await home(page);
  await expect(
    page.getByRole("heading", { name: "Ana sayfa yüklenemedi", exact: true }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.locator(".home-featured")).toBeVisible();
  let detailFail = true;
  await page.route("**/api/atlas/memory?*", async (route) =>
    detailFail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/#/memory/photo-${asset}?discussion=photo`);
  await expect(
    page.getByRole("heading", { name: "Anı yüklenemedi", exact: true }),
  ).toBeVisible();
  detailFail = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.locator(".native-conversation")).toBeVisible();
  expect((await page.request.post("/__test__/withdraw")).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(
    page.getByRole("heading", { name: "Anı bulunamadı", exact: true }),
  ).toBeVisible();
  await home(page);
  await expect(
    page.getByRole("heading", { name: "İlk buluşmamızı planlayalım" }),
  ).toBeVisible();
});

test("a failed optional Home chunk offers reload without requesting the archive", async ({
  page,
}) => {
  const requests = observe(page);
  await page.route("**/SocialHome-*.js", (route) => route.abort());
  await page.goto("/#/");
  await expect(
    page.getByRole("heading", { name: "Sayfa açılamadı", exact: true }),
  ).toBeVisible();
  await page.unroute("**/SocialHome-*.js");
  await page
    .getByRole("button", { name: "Yeniden yükle", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "İlk buluşmamızı planlayalım" }),
  ).toBeVisible();
  expect(
    requests.filter(
      (path) => path === "/api/atlas" || path === "/api/memories/notebook",
    ),
  ).toEqual([]);
});
