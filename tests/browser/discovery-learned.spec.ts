import { test, expect } from "@playwright/test";

test("retained local processing is explicit and Photos keyword retrieval survives opt-out", async ({
  page,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  const { group_id: group } = await (
    await page.request.get("/api/session")
  ).json();
  const reset = async () => {
    for (const groupWide of [true, false])
      expect(
        (
          await page.request.post("/api/discovery/processing", {
            data: { group, enabled: false, group_wide: groupWide },
          })
        ).ok(),
      ).toBe(true);
  };
  await reset();
  try {
    await page.goto("/#/settings");
    const personal = page.getByRole("checkbox", {
      name: "Allow local related-search processing of my contributions",
      exact: true,
    });
    const groupControl = page.getByRole("checkbox", {
      name: "Enable optional local processing for this group (admin)",
      exact: true,
    });
    await expect(personal).not.toBeChecked();
    await expect(groupControl).not.toBeChecked();
    await groupControl.check();
    await expect(
      page.getByText("Preference saved.", { exact: true }),
    ).toBeVisible();
    await personal.check();
    await expect(
      page.getByText("Preference saved.", { exact: true }),
    ).toBeVisible();
    const state = await (
      await page.request.get(`/api/discovery/state?group=${group}`)
    ).json();
    expect(state.settings.recognition).toBe(false);
    expect(state.settings.group_enabled).toBe(true);
    expect(state.settings.contribution_enabled).toBe(true);
    // Model-dependent retrieval remains a public API/domain capability, not a new UI workflow.
    if (process.env.MAZI_EMBEDDING_MODEL_DIR) {
      expect(state.settings.model_ready).toBe(true);
      expect(state.settings.learned).toBe(true);
      let remaining = 3;
      for (let batch = 0; batch < 5 && remaining; batch++) {
        const response = await page.request.post("/api/discovery/index", {
          data: { group, limit: 2 },
        });
        expect(response.ok()).toBe(true);
        remaining = (await response.json()).remaining;
      }
      expect(remaining).toBe(0);
      const related = await (
        await page.request.get(
          `/api/discovery/search?group=${group}&mode=semantic&query=${encodeURIComponent("people relaxing on a wooden dock beside a mountain lake")}`,
        )
      ).json();
      expect(related.items[0].title).toBe("Archive item one");
    }
    await personal.uncheck();
    await expect(
      page.getByText("Preference saved.", { exact: true }),
    ).toBeVisible();
    await groupControl.uncheck();
    await expect(
      page.getByText("Preference saved.", { exact: true }),
    ).toBeVisible();
    await page.goto("/#/photos?q=photo-0.jpg");
    await expect(page.locator(".mem-tile")).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: "Yerel arama dizini oluştur",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Arama türü", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath("keyword-with-processing-off.png"),
      fullPage: true,
    });
  } finally {
    await reset();
  }
});
