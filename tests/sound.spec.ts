import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 600;

type AudioSpy = {
  contexts: number;
  calls: Record<string, number>;
  gains: GainNode[];
  songStarts: number[];
};

/** Counts every AudioContext and every node it creates, without touching output. */
async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    const spy: AudioSpy = { contexts: 0, calls: {}, gains: [], songStarts: [] };
    (window as unknown as { __audio: AudioSpy }).__audio = spy;
    const Original = window.AudioContext;
    if (!Original) return;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        spy.contexts++;
      }
    };
    for (const proto of [
      BaseAudioContext.prototype,
      Original.prototype,
    ] as unknown as Record<string, unknown>[])
      for (const name of Object.getOwnPropertyNames(proto)) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, name);
        if (
          !name.startsWith("create") ||
          typeof descriptor?.value !== "function"
        )
          continue;
        const create = descriptor.value as (...args: unknown[]) => unknown;
        proto[name] = function (this: unknown, ...args: unknown[]) {
          spy.calls[name] = (spy.calls[name] || 0) + 1;
          const node = create.apply(this, args);
          if (name === "createGain") spy.gains.push(node as GainNode);
          if (name === "createMediaElementSource")
            spy.songStarts.push(spy.gains.at(-1)!.gain.value);
          return node;
        };
      }
  });
}

const audio = (page: Page) =>
  page.evaluate(() => (window as unknown as { __audio: AudioSpy }).__audio);
const calls = async (page: Page, name: string) =>
  (await audio(page)).calls[name] || 0;

async function signIn(page: Page) {
  expect(
    (
      await page.request.post("/api/entry", {
        data: { name: "Sample", code: "synthetic-shared-code" },
      })
    ).ok(),
  ).toBe(true);
  await page.addInitScript(() => sessionStorage.setItem("mazi.intro", "seen"));
}

async function remember(page: Page, key: string, value: string) {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    key,
    value,
  ] as const);
}

async function openAtlas(page: Page) {
  await page.goto("/?demo=1#/atlas");
  await expect(page.getByText("Drawing your atlas…")).toHaveCount(0);
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
}

async function soundToggle(page: Page) {
  const account = page.getByRole("button", { name: "Hesap", exact: true });
  if ((await account.getAttribute("aria-expanded")) !== "true")
    await account.click();
  return page
    .locator(".menu-popover")
    .getByRole("button", { name: "Sound", exact: true });
}

async function expectShown(page: Page, text: "Sound off" | "Sound on") {
  await expect(await soundToggle(page)).toHaveText(text);
}

test("sound is off until a member turns it on, and the choice survives a reload", async ({
  page,
}) => {
  await signIn(page);
  await openAtlas(page);
  const toggle = await soundToggle(page);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expectShown(page, "Sound off");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expectShown(page, "Sound on");
  expect(await page.evaluate(() => localStorage.getItem("mazi.sound"))).toBe(
    "on",
  );
  await page.reload();
  await expect(page.locator(".featured .photo-frame")).toHaveClass(/is-loaded/);
  await expect(await soundToggle(page)).toHaveAttribute("aria-pressed", "true");
  await expectShown(page, "Sound on");
});

test("with sound off, browsing the atlas never creates an AudioContext", async ({
  page,
}) => {
  await spyOnAudio(page);
  await signIn(page);
  await openAtlas(page);
  await page.getByRole("slider", { name: "Year" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/selected=lake-days/);
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(page).toHaveURL(/view=portal/);
  // The URL leads the render by a frame; Esc belongs to the portal once it holds focus.
  await expect(page.locator("#dossier-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/view=portal/);
  expect((await audio(page)).contexts).toBe(0);
});

test("with sound on, diving into the portal schedules a whoosh", async ({
  page,
}) => {
  await spyOnAudio(page);
  await remember(page, "mazi.sound", "on");
  await signIn(page);
  await openAtlas(page);
  expect((await audio(page)).contexts).toBe(0);
  // The browser lets audio start only after a gesture.
  await page.keyboard.press("Shift");
  await expect.poll(async () => (await audio(page)).contexts).toBe(1);
  await expect.poll(() => calls(page, "createMediaElementSource")).toBe(1);
  expect((await audio(page)).songStarts).toEqual([0]);
  expect(await calls(page, "createBufferSource")).toBe(0);
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(page).toHaveURL(/selected=last-ferry&view=portal/);
  await expect.poll(() => calls(page, "createBufferSource")).toBe(1);
  await expect(page.locator("#dossier-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/view=portal/);
  await expect.poll(() => calls(page, "createBufferSource")).toBe(2);
  expect((await audio(page)).contexts).toBe(1);
});

test("under reduced motion the whoosh is dropped but a year step still ticks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await spyOnAudio(page);
  await remember(page, "mazi.sound", "on");
  await signIn(page);
  await openAtlas(page);
  await page.keyboard.press("Shift");
  await expect.poll(() => calls(page, "createMediaElementSource")).toBe(1);
  const before = await calls(page, "createOscillator");
  await page.getByRole("slider", { name: "Year" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/selected=lake-days/);
  await expect
    .poll(() => calls(page, "createOscillator"))
    .toBeGreaterThan(before);
  await page.getByRole("link", { name: "Open memory", exact: true }).click();
  await expect(page).toHaveURL(/view=portal/);
  await page.waitForTimeout(300);
  expect(await calls(page, "createBufferSource")).toBe(0);
});

test("Entry offers the sound toggle", async ({ page }) => {
  await page.goto("/");
  const header = page.locator(".entry-header");
  const toggle = header.getByRole("button", { name: "Sound", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText("Sound off");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Sound on");
});

test("the headers with the sound toggle have no axe violations", async ({
  page,
}) => {
  // Six axe passes over two atlas loads; CI draws the globe in software meanwhile.
  test.setTimeout(120000);
  await signIn(page);
  for (const theme of ["night"] as const) {
    await remember(page, "mazi.theme", theme);
    await openAtlas(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const toggle = await soundToggle(page);
    for (const pressed of ["false", "true"]) {
      await expect(toggle).toHaveAttribute("aria-pressed", pressed);
      const scope = ".site-header";
      expect(
        (await new AxeBuilder({ page }).include(scope).analyze()).violations,
        `${theme} ${scope} pressed=${pressed}`,
      ).toEqual([]);
      if (pressed === "false") await toggle.click();
    }
    await toggle.click();
  }
  await page.context().clearCookies();
  for (const theme of ["night"] as const) {
    await remember(page, "mazi.theme", theme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      (await new AxeBuilder({ page }).include(".entry-header").analyze())
        .violations,
      `${theme} entry header`,
    ).toEqual([]);
  }
});

const evidence = "work/poteto/luminous-night/evidence/pr8";
test("captures evidence screenshots", async ({ page }) => {
  test.skip(!process.env.MAZI_EVIDENCE, "Set MAZI_EVIDENCE=1 to capture.");
  test.setTimeout(120000);
  const device = isPhone(page) ? "phone" : "desktop";
  const shot = (name: string, header = false) =>
    page.screenshot({
      path: `${evidence}/${name}-${device}-${theme}.jpg`,
      type: "jpeg",
      quality: 80,
      clip: header
        ? { x: 0, y: 0, width: page.viewportSize()!.width, height: 140 }
        : undefined,
    });
  await page.setViewportSize(
    device === "phone"
      ? { width: 390, height: 844 }
      : { width: 1440, height: 900 },
  );
  let theme: "night" | "day" = "night";
  for (theme of ["night"] as const) {
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate((value) => {
      localStorage.setItem("mazi.theme", value);
      localStorage.removeItem("mazi.sound");
      sessionStorage.setItem("mazi.intro", "seen");
    }, theme);
    await page.reload();
    await expect(page.getByLabel("Shared code")).toBeVisible();
    await shot("entry-sound-off");
    await page
      .locator(".entry-header")
      .getByRole("button", { name: "Sound", exact: true })
      .click();
    await shot("entry-sound-on");
    await page
      .locator(".entry-header")
      .getByRole("button", { name: "Sound", exact: true })
      .click();
    await signIn(page);
    await openAtlas(page);
    const toggle = await soundToggle(page);
    if (device === "phone") {
      await shot("more-sheet-sound-off");
      await toggle.click();
      await shot("more-sheet-sound-on");
      await toggle.click();
      continue;
    }
    await toggle.hover();
    await shot("header-sound-off", true);
    await toggle.click();
    await toggle.hover();
    await shot("header-sound-on", true);
    await shot("atlas-sound-on");
    for (const width of [1150, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await toggle.hover();
      await page.screenshot({
        path: `${evidence}/header-sound-on-${width}-${theme}.jpg`,
        type: "jpeg",
        quality: 80,
        clip: { x: 0, y: 0, width, height: 140 },
      });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await toggle.click();
  }
});
