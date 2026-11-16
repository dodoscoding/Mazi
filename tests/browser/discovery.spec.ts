import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { photoMatches } from "../helpers/photo-match";

test("retained People, personal hiding, subject removal and consent work through Settings and the viewer", async ({
  page,
  browser,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const profile = await (
    await page.request.post("/api/entry", {
      data: { name: "Alice", code: "synthetic-shared-code" },
    })
  ).json();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/settings");
  const processing = page.getByRole("checkbox", {
    name: "Allow local related-search processing of my contributions",
    exact: true,
  });
  const groupProcessing = page.getByRole("checkbox", {
    name: "Enable optional local processing for this group (admin)",
    exact: true,
  });
  await groupProcessing.check();
  await processing.check();
  await expect(
    page.getByText("Preference saved.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Person’s name", exact: true }),
  ).toBeVisible();
  const personName = `<img src=x onerror=alert(1)> ${info.project.name}`;
  await page
    .getByRole("textbox", { name: "Person’s name", exact: true })
    .fill(personName);
  await page
    .getByRole("button", { name: "Create person", exact: true })
    .click();
  await expect(page.locator("#settings-people")).toContainText(personName);
  await expect(
    page.locator("#settings-people img, #settings-people script"),
  ).toHaveCount(0);
  await page.goto("/#/photos?q=bicycle");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await page.locator(".mem-tile").click();
  await expect(
    page.getByRole("button", {
      name: "Remove my Ben association",
      exact: true,
    }),
  ).toHaveCount(0);
  const discovery = await (
    await page.request.get(`/api/discovery/state?group=${profile.group_id}`)
  ).json();
  const subject = discovery.people.find(
    (person: { name: string }) => person.name === "Ben",
  );
  expect(
    (
      await page.request.post("/api/discovery/disassociate", {
        data: { person: subject.id, asset: subject.assets[0] },
      })
    ).status(),
  ).toBe(403);

  await page
    .getByRole("button", {
      name: "Hide this photograph from my discovery",
      exact: true,
    })
    .click();
  await expect(page.locator(".viewer-track img")).toHaveCount(0);
  expect((await page.request.get("/api/session")).status()).toBe(200);
  const hiddenState = await (
    await page.request.get(`/api/discovery/state?group=${profile.group_id}`)
  ).json();
  const hidden = hiddenState.hidden.find(
    (item: { title: string }) => item.title === "Bicycle beside the sea",
  );
  const other = await browser.newContext({
    baseURL: String(info.project.use.baseURL),
  });
  try {
    await other.request.post("/api/entry", {
      data: { name: "Ben", code: "synthetic-shared-code" },
    });
    expect(
      (await other.request.get(`/api/archive/${hidden.id}/original`)).status(),
    ).toBe(200);
  } finally {
    await other.close();
  }
  await page.goto("/#/photos?q=bicycle");
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await page.goto("/#/settings");
  await page
    .getByRole("button", {
      name: "Restore hidden photograph: Bicycle beside the sea",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Restore hidden photograph: Bicycle beside the sea",
      exact: true,
    }),
  ).toHaveCount(0);
  await processing.uncheck();
  await expect(
    page.getByText("Preference saved.", { exact: true }),
  ).toBeVisible();
  await page.goto("/#/photos?q=bicycle");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    (
      await page.request.post("/api/discovery/person", {
        headers: { Origin: "https://elsewhere.test" },
        data: { group: profile.group_id, name: "No" },
      })
    ).status(),
  ).toBe(403);
  await page.request.post("/api/logout", { data: {} });
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.reload();
  await page.locator(".mem-tile").click();
  await page
    .getByRole("button", { name: "Remove my Ben association", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove my Ben association",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/#/settings");
  await expect(
    page.getByRole("checkbox", {
      name: "Enable optional local processing for this group (admin)",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Restore my association: Ben", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Restore my association: Ben",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/#/photos?q=bicycle");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath("retained-discovery.png"),
    fullPage: true,
  });
  await page.request.post("/api/logout", { data: {} });
  await page.context().addCookies([
    {
      name: "mazi_session",
      value: "synthetic-unmapped-session",
      url: new URL(page.url()).origin,
    },
  ]);
  const denied = await page.request.get(
    `/api/discovery/search?group=${profile.group_id}`,
  );
  expect(denied.status()).toBe(403);
  expect(await denied.text()).not.toContain("Amsterdam");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator(".mem-tile, .viewer-track img")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Photos preserves 1,001 authorized match identities and recovers atomic match-budget failure", async ({
  page,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const profile = await (await page.request.get("/api/session")).json();
  const map = await (
    await page.request.get(`/api/atlas?group=${profile.group_id}`)
  ).json();
  const base = map.memories[0];
  const ids = Array.from(
    { length: 1001 },
    (_, index) => `keyword-fixture-${index}`,
  );
  const cards = ids.map((id, index) => ({
    ...base,
    id,
    kind: "photo",
    title: `Keyword photograph ${index + 1}`,
    shortTitle: `Keyword photograph ${index + 1}`,
    photos: [
      {
        ...base.photos[0],
        assetId: id,
        src: `/api/archive/${id}/preview`,
        caption: `Keyword photograph ${index + 1}`,
      },
    ],
  }));
  await page.route("**/api/atlas?*", (route) =>
    route.fulfill({ json: { memories: cards } }),
  );
  await page.route("**/api/archive/keyword-fixture-*/preview", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    }),
  );
  let budgetExceeded = false;
  const requests: Record<string, string>[] = [];
  await page.route("**/api/discovery/matches?*", (route) => {
    requests.push(
      Object.fromEntries(new URL(route.request().url()).searchParams),
    );
    return route.fulfill(
      budgetExceeded
        ? {
            status: 400,
            json: {
              code: "capacity_exceeded",
              error: "Keyword search exceeded its metadata-work budget",
            },
          }
        : { json: photoMatches(ids) },
    );
  });
  await page.goto("/#/photos?q=scaling-keyword-fixture&years=2024");
  await expect(page.locator(".mem-tile")).toHaveCount(1001);
  await expect(
    page.locator('.mem-tile[href*="keyword-fixture-1000"]'),
  ).toHaveCount(1);
  budgetExceeded = true;
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(
    page.getByText(
      "İşleme sınırı aşıldı. Kısmi sonuç gösterilmez; filtreleri gözden geçirin.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("scaling-keyword-fixture");
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2024");
  budgetExceeded = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(1001);
  expect(requests.length).toBeGreaterThanOrEqual(3);
  expect(
    requests.every(
      (params) =>
        params.query === "scaling-keyword-fixture" && params.years === "2024",
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("match-budget-recovery.png"),
    fullPage: false,
  });
});
