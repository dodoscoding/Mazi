import type { Page } from "@playwright/test";

export async function openArchiveTools(page: Page) {
  const account = page.getByRole("button", { name: "Hesap", exact: true });
  await account.waitFor();
  if ((await account.getAttribute("aria-expanded")) !== "true")
    await account.click();
}

const exploreNames: Record<string, string> = {
  Timeline: "Zaman çizelgesi",
  Memories: "Fotoğraflar",
  Discover: "Yeniden keşfet",
  "Ask your archive": "Arşive sor",
  "Archive review": "Düzelt ve düzenle",
  "Places & sources": "Yerler ve kaynaklar",
};

export async function followShellLink(page: Page, name: string) {
  const main = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  if (name === "Home" || name === "Our circle") {
    await main
      .getByRole("link", {
        name: name === "Home" ? "Home" : "Grubumuz",
        exact: true,
      })
      .click();
    return;
  }
  if (name === "My Imports" || name === "Search") {
    await page
      .locator(".site-header")
      .getByRole("link", {
        name: name === "Search" ? "Anı ara" : "Ekle",
        exact: true,
      })
      .click();
    return;
  }
  if (name === "About" || name === "Replay introduction") {
    await openArchiveTools(page);
    await page
      .locator(".menu-popover")
      .getByRole("link", { name, exact: true })
      .click();
    return;
  }
  await main.getByRole("link", { name: "Keşfet", exact: true }).click();
  await page
    .getByRole("main")
    .getByRole("link", { name: exploreNames[name] || name, exact: true })
    .click();
}

export async function signOut(page: Page) {
  await openArchiveTools(page);
  await page
    .locator(".menu-popover")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
}
