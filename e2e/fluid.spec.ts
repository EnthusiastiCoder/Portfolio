import { test, expect } from "@playwright/test";

// WS5 fluid-sim-and-sound.
const FLUID = '[data-testid="fluid"]';

test("sound toggle defaults to off, turns on, and persists across reloads", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Sound" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.documentElement.dataset.soundEngine)).toBeUndefined();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-sound-engine", "fluid-audio-engine-v1");
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound" })).toHaveAttribute("aria-pressed", "true");
});

test("the audio engine is not in the first-load scripts", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  const srcs = [...html.matchAll(/<script[^>]+src="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
  expect(srcs.length).toBeGreaterThan(0);
  for (const src of srcs) {
    const body = await (await request.get(src)).text();
    expect(body, src).not.toContain("fluid-audio-engine-v1");
    // A uniform only the fluid shaders use: the sim must not be in first load either.
    expect(body, src).not.toContain("uDivergence");
  }
  await page.goto("/");
});

test("the fluid canvas mounts after load and pauses when the tab is hidden", async ({ page }) => {
  await page.goto("/");
  const fluid = page.locator(FLUID);
  await expect(fluid).toHaveAttribute("data-fluid-state", /running|idle/, { timeout: 15_000 });
  await page.mouse.move(200, 200);
  await page.mouse.move(600, 400, { steps: 8 });
  await expect(fluid).toHaveAttribute("data-fluid-state", "running");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(fluid).toHaveAttribute("data-fluid-state", "paused");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("shows the static gradient and never loads the sim", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await expect(page.locator(".fluid-static")).toBeVisible();
    await page.mouse.move(100, 100);
    await page.mouse.move(500, 300, { steps: 5 });
    await page.waitForTimeout(3_000);
    await expect(page.locator(FLUID)).toHaveCount(0);
  });
});

test("no WebGL2 gives the static gradient", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === "webgl2" && this.classList.contains("fluid-layer")) return null;
      return (orig as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof orig;
  });
  await page.goto("/");
  const fluid = page.locator(FLUID);
  await expect(fluid).toHaveAttribute("data-fluid-state", "static", { timeout: 15_000 });
  expect(await fluid.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain(
    "radial-gradient",
  );
});

for (const pill of ["red", "blue", "both"]) {
  test(`${pill} mode hides the native cursor on fine pointers, keeps it on links`, async ({
    page,
  }) => {
    await page.goto(`/?pill=${pill}`);
    const inside = await page.evaluate(
      () => getComputedStyle(document.querySelector("main")!).cursor,
    );
    expect(inside).toBe("none");
    const link = await page.evaluate(
      () => getComputedStyle(document.querySelector("main a")!).cursor,
    );
    expect(link).toBe("pointer");
  });
}

test.describe("coarse pointer", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 412, height: 915 } });
  test("blue mode keeps the cursor on touch devices", async ({ page }) => {
    await page.goto("/?pill=blue");
    expect(
      await page.evaluate(() => getComputedStyle(document.querySelector("main")!).cursor),
    ).not.toBe("none");
  });
});

test("sound toggle shows a visible focus ring", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Sound" });
  await toggle.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const outline = await toggle.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
});

// Fluid mode toggle: the dye through the rain digits (default) or the smoky fluid.
test("fluid mode toggle defaults to digits, switches to smoke, and persists", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Fluid through digits" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-fluid-mode", "chars");
  const fluid = page.locator(FLUID);
  await expect(fluid).toHaveAttribute("data-fluid-state", /running|idle/, { timeout: 15_000 });
  await expect(html).toHaveAttribute("data-fluid-live", "true");
  expect(await fluid.evaluate((el) => getComputedStyle(el).mixBlendMode)).toBe("multiply");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(html).toHaveAttribute("data-fluid-mode", "smoke");
  expect(await fluid.evaluate((el) => getComputedStyle(el).mixBlendMode)).toBe("screen");

  await page.reload();
  await expect(page.getByRole("button", { name: "Fluid through digits" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(html).toHaveAttribute("data-fluid-mode", "smoke");
});
