import { test, expect, devices, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const entry = { name: "Alice", code: "synthetic-shared-code" };
async function state(page: Page) {
  return (await page.request.get("/__test__/state")).json();
}
async function seed(
  page: Page,
  title = "Cumartesi buluşması",
  startLocal = "2030-06-01T18:00",
) {
  const { group } = await state(page);
  const response = await page.request.post("/api/social/plans/create", {
    data: {
      group,
      request_key: crypto.randomUUID(),
      title,
      start_local: startLocal,
      timezone: "Europe/Copenhagen",
      place: "Liman",
    },
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function detail(page: Page, plan: { id: string }) {
  const { group } = await state(page);
  await page.goto(`/#/circle?section=plans&group=${group}&plan=${plan.id}`);
  await expect(
    page.getByRole("heading", { name: "Planlar", exact: true }),
  ).toBeVisible();
}
async function fillPlan(page: Page) {
  await page.getByLabel("Başlık", { exact: true }).fill("Cumartesi birlikte");
  await page
    .getByLabel("Saat dilimi", { exact: true })
    .fill("Europe/Copenhagen");
  await page.getByLabel("Başlangıç", { exact: true }).fill("2030-06-01T18:00");
  await page.getByLabel("Yer (isteğe bağlı)", { exact: true }).fill("Liman");
  await page
    .getByLabel("Açıklama (isteğe bağlı)", { exact: true })
    .fill("Yanına bir hikâye al.");
}

test.beforeEach(async ({ page }) => {
  expect((await page.request.post("/__test__/reset")).ok()).toBe(true);
  expect((await page.request.post("/api/entry", { data: entry })).ok()).toBe(
    true,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("an empty circle plans on desktop and joins from an independent phone session", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "This case explicitly opens a desktop and phone together.",
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/atlas")
      requests.push(request.url());
  });
  expect((await state(page)).photos).toBe(0);
  await page.goto("/#/circle");
  await page
    .getByRole("navigation", { name: "Grup araçları" })
    .getByRole("link", { name: "Planlar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Yaklaşan bir buluşma yok",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Ekle seçenekleri" })
    .getByRole("link", { name: "Buluşma planla", exact: true })
    .click();
  await fillPlan(page);
  await page
    .getByRole("button", { name: "Buluşmayı oluştur", exact: true })
    .click();
  await expect(page).toHaveURL(/group=.*&plan=/);
  await expect(
    page.getByRole("heading", { name: "Cumartesi birlikte", exact: true }),
  ).toBeVisible();
  const phone = await browser.newContext({
    ...devices["Pixel 7"],
    timezoneId: "America/New_York",
    baseURL: info.project.use.baseURL,
  });
  try {
    expect(
      (
        await phone.request.post("/api/entry", {
          data: { ...entry, name: "Ben" },
        })
      ).ok(),
    ).toBe(true);
    const other = await phone.newPage();
    await other.emulateMedia({ reducedMotion: "reduce" });
    await other.goto(page.url());
    await expect(
      other.getByText("1 Haziran 2030 18:00", { exact: true }),
    ).toBeVisible();
    await other
      .getByRole("button", { name: "Geliyorum 0", exact: true })
      .click();
    await expect(
      other.getByRole("button", { name: "Geliyorum 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Planı yenile", exact: true })
      .click();
    await expect(
      page.getByRole("list", { name: "Katılım yanıtları" }),
    ).toContainText("Ben");
    await expect(
      page.getByRole("button", { name: "Geliyorum 1", exact: true }),
    ).toBeVisible();
    expect(requests).toEqual([]);
    expect((await state(page)).photos).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "work/poteto/social-plans-ui/plan-desktop.png",
      fullPage: true,
      scale: "css",
    });
    await other.setViewportSize({ width: 320, height: 844 });
    expect(
      await other.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page: other }).analyze()).violations,
    ).toEqual([]);
    await other.getByRole("heading", { name: "Planlar", exact: true }).focus();
    await other.evaluate(() => window.scrollTo(0, 0));
    await other.screenshot({
      path: "work/poteto/social-plans-ui/plan-phone.png",
      fullPage: true,
      scale: "css",
    });
    await other
      .getByRole("button", { name: "Yanıtımı kaldır", exact: true })
      .click();
    await expect(
      other.getByRole("button", { name: "Geliyorum 0", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  } finally {
    await phone.close();
  }
});

test("lost create responses retry the same command and produce one plan", async ({
  page,
}) => {
  const commands: object[] = [];
  await page.route("**/api/social/plans/create", async (route) => {
    commands.push(route.request().postDataJSON());
    const response = await route.fetch();
    if (commands.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  await page.goto("/#/circle?section=plans&new=1");
  await fillPlan(page);
  await page
    .getByRole("button", { name: "Buluşmayı oluştur", exact: true })
    .click();
  await expect(page.getByText(/İşlemin sonucu doğrulanamadı/)).toBeVisible();
  await expect(page.getByLabel("Başlık", { exact: true })).toHaveValue(
    "Cumartesi birlikte",
  );
  await page
    .getByRole("button", { name: "Aynı işlemi yeniden dene", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cumartesi birlikte", exact: true }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0]).toEqual(commands[1]);
  const { group } = await state(page);
  const plans = await (
    await page.request.get(`/api/social/plans?group=${group}`)
  ).json();
  expect(plans.items).toHaveLength(1);
});

test("stale edits reload the current plan without losing a draft", async ({
  page,
}) => {
  const plan = await seed(page);
  await detail(page, plan);
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page.getByLabel("Başlık", { exact: true }).fill("Benim taslağım");
  const { group } = await state(page);
  expect(
    (
      await page.request.post("/api/social/plans/update", {
        data: {
          group,
          plan: plan.id,
          revision: plan.revision,
          request_key: crypto.randomUUID(),
          patch: { title: "Başka sekmenin başlığı" },
        },
      })
    ).ok(),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet", exact: true })
    .click();
  await expect(page.getByText(/Plan değişti/)).toBeVisible();
  await page
    .getByRole("button", { name: "Güncel planı yükle", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Başka sekmenin başlığı", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Başlık", { exact: true })).toHaveValue(
    "Benim taslağım",
  );
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Benim taslağım", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".plan-form")).toHaveCount(0);
});

test("local time gaps are rejected and repeated hours require an explicit offset", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/#/circle?section=plans&new=1");
  await fillPlan(page);
  await page.getByLabel("Başlangıç", { exact: true }).fill("2030-03-31T02:30");
  await expect(page.getByRole("alert")).toContainText(
    "saati bu saat diliminde bulunmuyor",
  );
  await expect(
    page.getByRole("button", { name: "Buluşmayı oluştur", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Başlangıç", { exact: true }).fill("2030-10-27T02:30");
  const offset = page.getByRole("combobox", {
    name: "Başlangıç UTC farkı",
    exact: true,
  });
  await expect(offset).toBeVisible();
  await offset.selectOption("+01:00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "phone") {
    await page.getByRole("heading", { name: "Planlar", exact: true }).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "work/poteto/social-plans-ui/create-phone.png",
      fullPage: true,
      scale: "css",
    });
  }
  await page
    .getByRole("button", { name: "Buluşmayı oluştur", exact: true })
    .click();
  await expect(
    page.getByText("Europe/Copenhagen · UTC+01:00", { exact: true }),
  ).toBeVisible();
});

test("organizers edit, cancel and delete with attendance closed after cancellation", async ({
  page,
}) => {
  const plan = await seed(page, undefined, "2030-06-01T18:00:35");
  await detail(page, plan);
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page
    .getByLabel("Yer (isteğe bağlı)", { exact: true })
    .fill("Eski iskele");
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet", exact: true })
    .click();
  await expect(page.getByText("Eski iskele", { exact: true })).toBeVisible();
  const { group } = await state(page);
  const saved = await (
    await page.request.get(`/api/social/plan?group=${group}&plan=${plan.id}`)
  ).json();
  expect(saved.start_local).toBe(plan.start_local);
  await page
    .getByRole("button", { name: "Buluşmayı iptal et", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Buluşmayı iptal et", exact: true })
    .getByRole("button", { name: "Buluşmayı iptal et", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Buluşma iptal edildi", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Geliyorum 0", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Buluşmayı sil", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Buluşmayı sil", exact: true })
    .getByRole("button", { name: "Buluşmayı sil", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/circle\?section=plans$/);
  await expect(
    page.getByRole("heading", {
      name: "Yaklaşan bir buluşma yok",
      exact: true,
    }),
  ).toBeVisible();
});

test("a changed current circle clears drafts and rejects the old plan link", async ({
  page,
}) => {
  const plan = await seed(page, "Eski grubun özel planı");
  const { group, other } = await state(page);
  await detail(page, plan);
  await page.getByRole("button", { name: "Düzenle", exact: true }).click();
  await page
    .getByLabel("Açıklama (isteğe bağlı)", { exact: true })
    .fill("Gönderilmemiş özel taslak");
  expect((await page.request.post("/__test__/switch-circle")).ok()).toBe(true);
  await page.evaluate((id) => {
    sessionStorage.setItem("mazi.group", id);
    window.dispatchEvent(new Event("mazi:group"));
  }, other);
  await expect(
    page.getByRole("heading", { name: "Bu plan kullanılamıyor", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Açıklama (isteğe bağlı)", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Eski grubun özel planı", { exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.get(`/api/social/plan?group=${group}&plan=${plan.id}`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/social/attendance", {
        data: {
          group,
          plan: plan.id,
          state: "yes",
          request_key: crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(403);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bu plan kullanılamıyor", exact: true }),
  ).toBeVisible();
});

test("read failures retry and demo cannot create a real plan", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/social/plans?*", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic unavailable" }),
      });
    else await route.continue();
  });
  await page.goto("/#/circle?section=plans");
  await expect(
    page.getByRole("heading", { name: "Planlar yüklenemedi", exact: true }),
  ).toBeVisible();
  fail = false;
  await page
    .getByRole("button", { name: "Yeniden yükle", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Yaklaşan bir buluşma yok",
      exact: true,
    }),
  ).toBeVisible();
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/social/"))
      writes++;
  });
  await page.goto("/?demo=1#/circle?section=plans&new=1");
  await expect(page.getByText(/Örnek arşivde plan oluşturulmaz/)).toBeVisible();
  await expect(page.getByLabel("Başlık", { exact: true })).toHaveCount(0);
  expect(writes).toBe(0);
});

test("the contribution menu and plan form work with the keyboard at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/#/circle?section=plans");
  const add = page.getByRole("button", { name: "Ekle", exact: true });
  await add.focus();
  await page.keyboard.press("ArrowDown");
  const menuBounds = await page
    .locator(".add-menu .menu-popover")
    .boundingBox();
  expect(menuBounds!.x).toBeGreaterThanOrEqual(0);
  expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(320);
  await expect(
    page
      .getByRole("navigation", { name: "Ekle seçenekleri" })
      .getByRole("link", { name: "Fotoğraf veya arşiv", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page
      .getByRole("navigation", { name: "Ekle seçenekleri" })
      .getByRole("link", { name: "Buluşma planla", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Başlık", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Saat dilimi", { exact: true })).toBeFocused();
});
