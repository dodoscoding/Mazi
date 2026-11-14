import { test, expect } from "@playwright/test";

test("Past creations retains historical reads and only authorized deletion", async ({
  page,
}, info) => {
  const profile = await (
    await page.request.post("/api/entry", {
      data: {
        name: `Past ${info.project.name}`,
        code: "synthetic-shared-code",
      },
    })
  ).json();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/settings");
  await page.getByRole("link", { name: "Past creations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Past creations", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "<img src=x onerror=alert(1)> Historical summer recollection.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator("img[onerror]")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Open capsule", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Historical opened capsule",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Photograph inside the opened capsule"),
  ).toBeVisible();
  const capsuleDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export capsule", exact: true })
    .click();
  expect((await capsuleDownload).suggestedFilename()).toBe("mazi-capsule.json");
  await expect(
    page.getByText(`Sealed secret ${info.project.name}`, { exact: false }),
  ).toHaveCount(0);
  const capsules = await (
    await page.request.get(`/api/memories/capsules?group=${profile.group_id}`)
  ).json();
  const sealed = capsules.find(
    (item: { locked: boolean; can_delete: boolean }) =>
      item.locked && item.can_delete,
  );
  for (const endpoint of ["capsule", "capsule-export", "capsule-photo"])
    expect(
      (
        await page.request.get(
          `/api/memories/${endpoint}?group=${profile.group_id}&capsule=${sealed.id}&now=9999999999`,
        )
      ).status(),
    ).toBe(403);
  const stories = await (
    await page.request.get(`/api/memories/stories?group=${profile.group_id}`)
  ).json();
  const historical = stories.find(
    (item: { contributions: { text: string }[] }) =>
      item.contributions.some((entry) =>
        entry.text.includes("Historical summer recollection"),
      ),
  );
  await page.goto(`/#/memories?section=stories&story=${historical.id}`);
  await expect(page).toHaveURL(
    new RegExp(`/past-creations\\?story=${historical.id}`),
  );
  await expect(
    page.getByText(
      "<img src=x onerror=alert(1)> Historical summer recollection.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete story", exact: true }),
  ).toHaveCount(0);
  await page.getByText("Original photographs", { exact: true }).click();
  await expect(
    page.getByAltText("Original photograph from this saved story"),
  ).toHaveCount(3);
  await expect(
    page.getByAltText("Original photograph from this saved story").first(),
  ).toBeVisible();
  await expect(page.locator("#grid")).toHaveCount(0);
  const storyDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export story JSON", exact: true })
    .click();
  expect((await storyDownload).suggestedFilename()).toBe("mazi-story.json");
  expect(
    (
      await page.request.post("/api/memories/delete", {
        data: {
          group: profile.group_id,
          story: historical.id,
          revision: historical.revision,
        },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/#/past-creations");
  await page.getByRole("button", { name: "Delete story", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByText(`Historical own ${info.project.name}`, { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Delete capsule", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sealed capsule", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Past creations", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `work/poteto/app-simplification/past-creations-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.route("**/api/memories/stories?*", (route) =>
    route.fulfill({ status: 403, json: { error: "Access withdrawn" } }),
  );
  await page
    .getByRole("button", { name: "Refresh Past creations", exact: true })
    .click();
  await expect(page.getByLabel("Shared code")).toBeVisible();
  await expect(page.locator(".past-card")).toHaveCount(0);
  await expect(
    page.getByAltText("Photograph inside the opened capsule"),
  ).toHaveCount(0);
});
