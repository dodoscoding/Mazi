import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test("Add resolves duplicate and event suggestions with evidence and retained undo", async ({
  page,
}, info) => {
  await page.request.post("/api/entry", {
    data: { name: "Alice", code: "synthetic-shared-code" },
  });
  await page.goto("/#/add");
  const fixture = execFileSync(".venv/bin/python", [
    "-c",
    "import io,sys,zipfile; from PIL import Image; a=io.BytesIO(); z=zipfile.ZipFile(a,'w');\nfor name,q in [('red.jpg',90),('compressed.jpg',40)]:\n p=io.BytesIO(); Image.new('RGB',(40,40),'red').save(p,'JPEG',quality=q); z.writestr(name,p.getvalue())\nz.close(); sys.stdout.buffer.write(a.getvalue())",
  ]);
  await page.locator("#upload select[name=source]").selectOption("manual");
  await page.getByLabel("Source account label").fill("Add queue fixture");
  await page
    .getByLabel("Export ZIP")
    .setInputFiles({
      name: "queues.zip",
      mimeType: "application/zip",
      buffer: fixture,
    });
  await page
    .getByRole("button", { name: "Upload and inspect inventory", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("inventoried");
  await page
    .getByRole("button", { name: "Start importing to group", exact: true })
    .click();
  await expect(page.locator("#report-title")).toContainText("completed");
  const [group] = await (await page.request.get("/api/groups")).json();
  const photographs = await (
    await page.request.get(`/api/archive?group=${group.id}`)
  ).json();
  expect(photographs).toHaveLength(2);
  for (const photograph of photographs) {
    expect(
      (
        await page.request.post("/api/review/correct", {
          data: {
            asset: photograph.id,
            title: "",
            capture_date: "2020-10-06",
            place: "Amsterdam",
            anniversary: false,
          },
        })
      ).ok(),
    ).toBe(true);
  }
  await expect(
    page.getByRole("link", { name: "Suggestions", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Suggestions", exact: true }).click();
  await expect(page).toHaveURL(/#\/add\?section=suggestions$/);
  await expect(
    page.getByRole("heading", { name: "Add", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Timeline", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Download archive", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Leave group and withdraw my contributions",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.locator("#duplicates article")).toHaveCount(1);
  await expect(page.locator("#duplicates")).toContainText("pixel distance");
  await expect(page.locator("#duplicates a[target=_blank]")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Merge presentation", exact: true })
    .click();
  await expect(page.locator("#reviewed-pairs")).toContainText(
    "Merged for presentation",
  );
  await page.getByRole("button", { name: "Split pair", exact: true }).click();
  await expect(page.locator("#duplicates article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Keep separate", exact: true })
    .click();
  await expect(page.locator("#reviewed-pairs")).toContainText("Kept separate");
  await page
    .getByRole("button", { name: "Undo decision", exact: true })
    .click();
  await page
    .getByLabel("Event title", { exact: true })
    .fill("Add suggested event");
  await page
    .getByRole("button", { name: "Accept selected photos", exact: true })
    .click();
  await expect(page.locator("#reviewed-events")).toContainText(
    "Add suggested event",
  );
  await page.getByRole("button", { name: "Undo event", exact: true }).click();
  await expect(page.locator("#events article")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Reject suggestion", exact: true })
    .click();
  await expect(page.locator("#reviewed-events")).toContainText(
    "Rejected suggestion",
  );
  await page.reload();
  await expect(page.locator("#reviewed-events")).toContainText(
    "Rejected suggestion",
  );
  await page.getByRole("button", { name: "Undo event", exact: true }).click();
  await expect(page.locator("#events article")).toHaveCount(1);
  await page.screenshot({
    path: `work/poteto/app-simplification/queues-${info.project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});
