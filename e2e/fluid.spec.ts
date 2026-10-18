import { test, expect, devices } from "@playwright/test";

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
    expect(body, src).not.toContain("EXT_color_buffer_float");
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
  test("draws one still frame and runs no loop", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(FLUID)).toHaveAttribute("data-fluid-state", "still", {
      timeout: 15_000,
    });
    await page.mouse.move(100, 100);
    await page.mouse.move(500, 300, { steps: 5 });
    await expect(page.locator(FLUID)).toHaveAttribute("data-fluid-state", "still");
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

test("blue mode hides the native cursor on fine pointers, keeps it on links", async ({ page }) => {
  await page.goto("/?pill=blue");
  const inside = await page.evaluate(
    () => getComputedStyle(document.querySelector("main")!).cursor,
  );
  expect(inside).toBe("none");
  const link = await page.evaluate(
    () => getComputedStyle(document.querySelector("main a")!).cursor,
  );
  expect(link).toBe("pointer");
  await page.goto("/?pill=red");
  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector("main")!).cursor),
  ).not.toBe("none");
});

test.describe("coarse pointer", () => {
  test.use({ ...devices["Pixel 7"] });
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
