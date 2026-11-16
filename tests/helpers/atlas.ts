import type { Page } from "@playwright/test";

/** Open the selected photograph directly in the shared viewer. */
export async function openFullMemory(page: Page) {
  await page.getByRole("link", { name: "Anıyı aç", exact: true }).click();
}

/**
 * Waits for finite CSS animations (the HUD's reduced-motion fade, a toast's fade-in)
 * to finish, so contrast checks measure the settled page rather than a frame of a fade.
 */
export async function settled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}
