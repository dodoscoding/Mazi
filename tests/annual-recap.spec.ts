import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

test("Annual recap opens from a Photos year card in capture order and restores its viewer origin", async ({
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
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  const card = page.getByRole("link", {
    name: "Annual recap 2024",
    exact: true,
  });
  await expect(card).toBeVisible();
  await card.click();
  await expect(
    page.getByRole("heading", {
      name: "Annual recap 2024",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator(".photo-month h2")).toHaveText([
    "Ocak 2024",
    "Şubat 2024",
    "Haziran 2024",
  ]);
  expect(
    await page
      .locator(".mem-tile img")
      .evaluateAll((images) => images.map((img) => img.getAttribute("alt"))),
  ).toEqual([
    "Bicycle beside the sea",
    "Garden in the morning",
    "Dinner with friends",
    "February morning",
    "June evening",
  ]);
  const photo = page.locator(".mem-tile").filter({
    has: page.getByRole("img", { name: "Dinner with friends", exact: true }),
  });
  await photo.scrollIntoViewIfNeeded();
  const origin = page.url();
  const position = await page.evaluate(() => scrollY);
  await photo.click();
  await expect(page.locator(".viewer-caption-text")).toContainText(
    "Dinner with friends",
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(origin);
  await expect(photo).toBeFocused();
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - position))
    .toBeLessThan(3);
  await page.screenshot({
    path: `work/poteto/app-simplification/recap-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("Annual recap excludes uncertain and sharing-only chronology without hiding it from Photos", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/#/photos?recap=2023");
  await expect(page.locator(".mem-tile img")).toHaveAttribute(
    "alt",
    "Spring picnic",
  );
  await page.goto("/#/photos?recap=2026");
  await expect(
    page.getByRole("heading", {
      name: "2026 için güvenilir çekim tarihli fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await page.goto("/#/photos?recap=1901");
  await expect(
    page.getByRole("heading", {
      name: "1901 için güvenilir çekim tarihli fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#/photos?recap=not-a-year");
  await expect(
    page.getByRole("heading", { name: "Geçerli bir yıl seçin", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Fotoğraflara dön", exact: true })
    .click();
  const year = page.getByRole("combobox", { name: "Yıl", exact: true });
  await year.selectOption("2026");
  await expect(
    page.getByRole("img", { name: "Shared at the reunion", exact: true }),
  ).toBeVisible();
  await year.selectOption("2024");
  await expect(
    page.getByRole("img", { name: "Shared-only 2024", exact: true }),
  ).toBeVisible();
  await year.selectOption("undated");
  for (const name of [
    "Conflicting capture 2024",
    "Conflicting capture years",
    "Conflicting years",
    "Unlabelled photograph",
  ]) {
    await expect(page.getByRole("img", { name, exact: true })).toBeVisible();
  }
});

test("Annual recap covers the whole capture year and returns to the prior Photos filters", async ({
  page,
}) => {
  await page.request.post("/api/entry", {
    data: { name: "Ben", code: "synthetic-shared-code" },
  });
  await page.goto("/#/photos");
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  await page.locator("#filters-open").click();
  const filters = page.getByRole("dialog", { name: "Filtreler", exact: true });
  await filters.getByLabel(/stanbul/).check();
  await filters
    .getByRole("button", { name: "1 fotoğrafı göster", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  const origin = page.url();
  await page
    .getByRole("link", { name: "Annual recap 2024", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(5);
  await expect(page.locator("#recap-scope")).toContainText(
    "Normal Fotoğraflar filtreleri bu özette uygulanmaz",
  );
  await expect(
    page.getByRole("button", { name: "Filtreler", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Fotoğraflara dön", exact: true })
    .click();
  await expect(page).toHaveURL(origin);
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2024");
  await expect(page.locator(".mem-tile img")).toHaveAttribute(
    "alt",
    "Dinner with friends",
  );
});

test("Annual recap rechecks withdrawn photographs and session access", async ({
  page,
}, info) => {
  const login = await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const profile = await login.json();
  const sources = await (
    await page.request.get(`/api/sources?group=${profile.group_id}`)
  ).json();
  const source = sources.find(
    (item: { label: string }) => item.label === "Synthetic Photos",
  );
  const data = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys; from PIL import Image; p=io.BytesIO(); Image.new('RGB',(89,57),(39,127,191)).save(p,'JPEG'); sys.stdout.buffer.write(p.getvalue())",
  ]);
  const begin = await page.request.post("/api/sources/begin", {
    data: {
      connection: source.id,
      metadata: {
        item: `recap-${info.project.name}-${Date.now()}`,
        component: "photo",
        version: "original",
        filename: "recap-private.jpg",
        date: "2024-05-01",
        capture_date: "2024-05-01",
        kind: "image",
        albums: [],
      },
      size: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    },
  });
  expect(begin.ok()).toBe(true);
  const resource = await begin.json();
  let withdrawn = false;
  try {
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
        const rows = await (
          await page.request.get(
            `/api/sources/resources?connection=${source.id}`,
          )
        ).json();
        return rows.find((item: { id: string }) => item.id === resource.id)
          ?.state;
      })
      .toBe("AVAILABLE_TO_GROUP");
    const archive = await (
      await page.request.get(`/api/archive?group=${profile.group_id}`)
    ).json();
    const photograph = archive.find(
      (item: { origins: { original_filename: string }[] }) =>
        item.origins.some(
          (origin) => origin.original_filename === "recap-private.jpg",
        ),
    );
    expect(photograph).toBeTruthy();
    expect(
      (
        await page.request.post("/api/review/correct", {
          data: {
            asset: photograph.id,
            title: "Temporary recap photograph",
            capture_date: "2024-05-01",
            place: "",
            anniversary: false,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto("/#/photos?recap=2024");
    await expect(
      page.getByRole("img", {
        name: "Temporary recap photograph",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".mem-tile")).toHaveCount(6);
    expect(
      (
        await page.request.post("/api/sources/withdraw", {
          data: { id: resource.id },
        })
      ).ok(),
    ).toBe(true);
    withdrawn = true;
    await page.reload();
    await expect(page.locator(".mem-tile")).toHaveCount(5);
    await expect(
      page.getByRole("img", {
        name: "Temporary recap photograph",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.get(`/api/sources/original?id=${resource.id}`)
      ).status(),
    ).toBe(403);
    expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
      true,
    );
    await page.reload();
    await expect(page.getByLabel("Shared code")).toBeVisible();
    await expect(page.locator(".mem-tile")).toHaveCount(0);
  } finally {
    if (!withdrawn)
      await page.request.post("/api/sources/withdraw", {
        data: { id: resource.id },
      });
  }
});
