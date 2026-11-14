import type { Page } from "@playwright/test";

export async function openArchiveTools(page: Page) {
  const account = page.getByRole("button", { name: "Hesap", exact: true });
  await account.waitFor();
  if ((await account.getAttribute("aria-expanded")) !== "true")
    await account.click();
}

export async function followShellLink(page: Page, name: string) {
  const nav = page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .filter({ visible: true })
    .first();
  const labels: Record<string, string> = {
    Home: "Globe",
    Atlas: "Globe",
    Timeline: "Photos",
    Memories: "Photos",
    Fotoğraflar: "Photos",
    Discover: "Photos",
    "Our circle": "Settings",
    "My Imports": "Add",
    About: "Settings",
  };
  if (name === "Search") {
    await page
      .locator(".site-header")
      .getByRole("link", { name: "Anı ara", exact: true })
      .click();
    return;
  }
  if (name === "Places & sources" || name === "Archive review") {
    await nav.getByRole("link", { name: "Add", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Add sections" })
      .getByRole("link", {
        name:
          name === "Places & sources" ? "Source connections" : "Suggestions",
        exact: true,
      })
      .click();
    return;
  }
  if (name === "Replay introduction") {
    await nav.getByRole("link", { name: "Settings", exact: true }).click();
    await page
      .getByRole("link", { name: "Replay introduction", exact: true })
      .click();
    return;
  }
  await nav
    .getByRole("link", { name: labels[name] || name, exact: true })
    .click();
}

export async function signOut(page: Page) {
  await openArchiveTools(page);
  await page
    .locator(".account-menu .menu-popover")
    .getByRole("button", { name: "Çıkış yap", exact: true })
    .click();
}
