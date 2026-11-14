import { test, expect } from "@playwright/test";

test("Globe search opens Photos and preserves keyword filters and the selected photograph", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const answers: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/answers/ask")) answers.push(request.url());
  });
  await page.goto("/#/atlas");
  await page.getByRole("link", { name: "Anı ara", exact: true }).click();
  await expect(page).toHaveURL(/#\/photos/);
  const query = page.getByRole("searchbox", {
    name: "Fotoğraf ve konuşmalarda ara",
    exact: true,
  });
  await expect(query).toBeFocused();
  await page
    .getByRole("combobox", { name: "Yıl", exact: true })
    .selectOption("2024");
  await query.fill("Dinner");
  await page.getByRole("button", { name: "Arşivde ara", exact: true }).click();
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await expect(page).toHaveURL(/q=Dinner/);
  const origin = page.url();
  const href = await page.locator(".mem-tile").getAttribute("href");
  const selectedIndex = Number(
    new URLSearchParams(href!.split("?")[1]).get("photo") || 0,
  );
  await page.locator(".mem-tile").click();
  await expect(page.locator(".viewer-track img")).toHaveAttribute(
    "alt",
    "Dinner with friends",
  );
  await expect(page.locator(".viewer-count")).toHaveText(
    `${selectedIndex + 1} / 3`,
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(origin);
  await expect(query).toHaveValue("Dinner");
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2024");
  await expect(page.locator(".mem-tile")).toBeFocused();
  expect(answers).toEqual([]);
  await expect(
    page.getByRole("link", { name: /Ask your archive|Arşivine sor/ }),
  ).toHaveCount(0);
});

test("Photos searches photographs first and opens actual text-only Conversation context", async ({
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
  await page.goto("/#/photos?q=ferry");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  const conversations = page.getByRole("region", {
    name: "Konuşma sonuçları",
    exact: true,
  });
  await expect(conversations).toBeVisible();
  const result = conversations.getByRole("button", {
    name: /The lanterns are ready/,
  });
  await expect(result).toBeVisible();
  expect((await page.locator("#grid").boundingBox())!.y).toBeLessThan(
    (await conversations.boundingBox())!.y,
  );
  await result.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await result.click();
  const context = page.getByRole("region", {
    name: "Kaynak konuşma bağlamı",
    exact: true,
  });
  await expect(context).toBeVisible();
  await expect(context).toContainText("Lena");
  await expect(context).toContainText("Bring the paper map to the ferry.");
  await expect(context).toContainText("lantern-chat.txt#line:1");
  await expect(context.locator("img, a[href*='/memory/']")).toHaveCount(0);
  await page.screenshot({
    path: `work/poteto/app-simplification/search-context-${info.project.name}.png`,
    fullPage: true,
  });
  await context
    .getByRole("button", { name: "Bağlamı kapat", exact: true })
    .click();
  await expect(context).toBeHidden();
  await expect(result).toBeFocused();
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("ferry");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
});

test("Photos clears an open text-only context immediately when its contribution is withdrawn", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  const profile = await (await page.request.get("/api/session")).json();
  const { execFileSync } = await import("node:child_process");
  const { createHash } = await import("node:crypto");
  const archive = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); z.writestr('moon-chat.txt','07/01/2024, 19:00 - Nora: Moonstone logistics'); z.close(); sys.stdout.buffer.write(b.getvalue())",
  ]);
  const begin = await page.request.post("/api/imports/start", {
    data: {
      group: profile.group_id,
      source: "whatsapp",
      namespace: `search-${info.project.name}`,
      size: archive.length,
      sha256: createHash("sha256").update(archive).digest("hex"),
      options: { date_order: "DMY" },
    },
  });
  expect(begin.ok()).toBe(true);
  const { id } = await begin.json();
  expect(
    (
      await page.request.post("/api/imports/chunk", {
        data: { id, offset: 0, data: archive.toString("base64") },
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
  await page.goto("/#/add");
  await page.locator(`#imports [data-run="${id}"]`).click();
  await page
    .getByRole("button", { name: "Start importing to group", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Withdraw this contribution",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#/photos?q=Moonstone");
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await page
    .getByRole("region", { name: "Konuşma sonuçları", exact: true })
    .getByRole("button", { name: /Moonstone logistics/ })
    .click();
  const context = page.getByRole("region", {
    name: "Kaynak konuşma bağlamı",
    exact: true,
  });
  await expect(context).toContainText("Moonstone logistics");
  expect(
    (await page.request.post("/api/imports/withdraw", { data: { id } })).ok(),
  ).toBe(true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/atlas?*", async (route) => {
    await gate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Fotoğrafları yenile", exact: true })
    .click();
  try {
    await expect(context).toBeHidden();
  } finally {
    release();
  }
  await expect(page.locator("#conversation-list")).toBeEmpty();
  await expect(page.locator("#conversation-status")).toHaveText(
    "Eşleşen konuşma yok.",
  );
  await expect(
    page.getByRole("searchbox", {
      name: "Fotoğraf ve konuşmalarda ara",
      exact: true,
    }),
  ).toHaveValue("Moonstone");
});

test("Photos conversation search explains loading, retry, filter scope and empty results", async ({
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
  await page.route("**/api/discovery/conversations?*", async (route) => {
    if (!fail) return route.continue();
    fail = false;
    await gate;
    await route.fulfill({
      status: 503,
      json: { error: "Synthetic source unavailable" },
    });
  });
  await page.goto("/#/photos?q=ferry");
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await expect(page.locator("#conversation-status")).toHaveText(
    "Konuşmalar aranıyor…",
  );
  release();
  await expect(page.locator("#conversation-status")).toContainText(
    "Konuşmalar yüklenemedi",
  );
  await expect(page.locator(".mem-tile")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Konuşmaları yeniden dene", exact: true })
    .click();
  await expect(page.locator("#conversation-list")).toContainText(
    "The lanterns are ready",
  );
  await page.goto("/#/photos?q=ferry&source=whatsapp&years=2025");
  await expect(page.locator(".mem-tile")).toHaveCount(0);
  await expect(page.locator("#conversation-list button")).toHaveCount(2);
  await expect(page.locator("#conversation-scope")).toContainText(
    "Yıl, çekim tarihi, yer ve fotoğraf etiketleri yalnız fotoğraflara uygulanır",
  );
  await expect(
    page.getByRole("combobox", { name: "Yıl", exact: true }),
  ).toHaveValue("2025");
  await page.goto("/#/photos?q=unfindableterm");
  await expect(page.locator("#conversation-status")).toHaveText(
    "Eşleşen konuşma yok.",
  );
  await expect(
    page.getByRole("heading", {
      name: "Bu filtrelerle eşleşen fotoğraf yok",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aramayı temizle", exact: true })
    .click();
  await expect(page.locator(".mem-tile")).toHaveCount(8);
  await expect(
    page.getByRole("region", { name: "Konuşma sonuçları", exact: true }),
  ).toBeHidden();
});

test("Photos removes all retained conversation context when the session is lost", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Ben", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/#/photos?q=ferry");
  const result = page
    .getByRole("region", { name: "Konuşma sonuçları", exact: true })
    .getByRole("button", { name: /The lanterns are ready/ });
  await result.click();
  await expect(
    page.getByRole("region", { name: "Kaynak konuşma bağlamı", exact: true }),
  ).toContainText("Lena");
  expect((await page.request.post("/api/logout", { data: {} })).ok()).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Bağlamı kapat", exact: true })
    .click();
  await result.click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(
    page.locator("#source-content, #conversation-list, .mem-tile"),
  ).toHaveCount(0);
});

test("Photos offers honest continuation before reporting no conversation matches", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Alice", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  const profile = await (await page.request.get("/api/session")).json();
  const { execFileSync } = await import("node:child_process");
  const { createHash } = await import("node:crypto");
  const text = Array.from(
    { length: 300 },
    (_, index) => `07/01/2024, 19:00 - Nora: needle item ${index}`,
  ).join("\n");
  const archive = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); z.writestr('many.txt',sys.argv[1]); z.close(); sys.stdout.buffer.write(b.getvalue())",
    text,
  ]);
  const start = await page.request.post("/api/imports/start", {
    data: {
      group: profile.group_id,
      source: "whatsapp",
      namespace: `continuation-${info.project.name}`,
      size: archive.length,
      sha256: createHash("sha256").update(archive).digest("hex"),
      options: { date_order: "DMY" },
    },
  });
  expect(start.ok()).toBe(true);
  const { id } = await start.json();
  expect(
    (
      await page.request.post("/api/imports/chunk", {
        data: { id, offset: 0, data: archive.toString("base64") },
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
  try {
    await page.goto("/#/photos?q=absentword");
    await expect(page.locator("#conversation-status")).toContainText(
      "Diğer kaynak kayıtları henüz aranmadı",
    );
    await expect(page.locator("#conversation-list")).toBeEmpty();
    await page
      .getByRole("button", {
        name: "Diğer konuşma sonuçlarını getir",
        exact: true,
      })
      .click();
    await expect(page.locator("#conversation-status")).toHaveText(
      "Eşleşen konuşma yok.",
    );
    await page
      .getByRole("searchbox", {
        name: "Fotoğraf ve konuşmalarda ara",
        exact: true,
      })
      .fill("needle");
    await page
      .getByRole("button", { name: "Arşivde ara", exact: true })
      .click();
    await expect(page.locator("#conversation-list button")).toHaveCount(50);
    const more = page.getByRole("button", {
      name: "Diğer konuşma sonuçlarını getir",
      exact: true,
    });
    for (
      let pageNumber = 0;
      pageNumber < 7 && (await more.isVisible());
      pageNumber++
    ) {
      await more.click();
      await expect(page.locator("#conversation-status")).not.toHaveText(
        "Konuşmalar aranıyor…",
      );
    }
    await expect(more).toBeHidden();
    await expect(page.locator("#conversation-list button")).toHaveCount(300);
  } finally {
    await page.goto("/#/add");
    await page.locator(`#imports [data-run="${id}"]`).click();
    await page
      .getByRole("button", { name: "Withdraw this contribution", exact: true })
      .click();
    await expect(page.locator("#report-state")).toHaveText("Withdrawn");
    expect(
      (await (await page.request.get(`/api/imports/${id}`)).json()).withdrawn,
    ).toBe(true);
  }
});
