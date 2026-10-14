import type { Page } from "@playwright/test";

/** Opens the archive tools: the header menu on wide screens, More on phones. */
export async function openArchiveTools(page: Page) {
  const more = page.getByRole("button", { name: "More", exact: true });
  const tools = page.getByRole("button", { name: "Archive tools" });
  await more.or(tools).first().waitFor();
  if (await more.isVisible()) {
    if ((await more.getAttribute("aria-expanded")) !== "true")
      await more.click();
    await page.getByRole("dialog", { name: "More" }).waitFor();
    return;
  }
  if ((await tools.getAttribute("aria-expanded")) !== "true")
    await tools.click();
}

/** Follows a shell link, opening the archive tools first when it lives there. */
export async function followShellLink(page: Page, name: string) {
  const link = page.getByRole("link", { name, exact: true });
  if ((await link.count()) === 0) await openArchiveTools(page);
  await link.first().click();
}

export async function signOut(page: Page) {
  await openArchiveTools(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
}
