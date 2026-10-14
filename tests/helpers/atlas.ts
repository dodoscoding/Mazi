import type { Page } from "@playwright/test";

/** Open memory dives into the Atlas portal; the dossier's Open memory reaches the full memory. */
export async function openFullMemory(page: Page) {
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await page
    .locator(".dossier")
    .getByRole("link", { name: "Open memory", exact: true })
    .click();
}
