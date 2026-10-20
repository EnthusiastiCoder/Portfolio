import { test, expect } from "@playwright/test";

const NOTICE = "© Arpan Mandal. All Rights Reserved.";
const RAIN = '[data-testid="matrix-rain"]';

// Case 92a (WS2)
test("rain canvas starts in worker or main-thread mode and is hidden from AT", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const rain = page.locator(RAIN);
  await expect(rain).toBeAttached({ timeout: 5_000 });
  await expect(rain).toHaveAttribute("aria-hidden", "true");
  await expect(rain).toHaveAttribute("data-mode", /^(worker|main-thread)$/, { timeout: 5_000 });
});

// Case 92b (WS2)
test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("rain is static (or absent) and does not change between frames", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    // Give the idle-time start a chance to run before deciding it is absent.
    await page.waitForTimeout(1_000);
    const rain = page.locator(RAIN);
    if ((await rain.count()) === 0) return;

    await expect(rain).toHaveAttribute("data-mode", "static", { timeout: 5_000 });
    await page.waitForTimeout(300);
    const first = await rain.screenshot({ animations: "disabled" });
    await page.waitForTimeout(500);
    const second = await rain.screenshot({ animations: "disabled" });
    expect(first.equals(second)).toBe(true);
  });
});

// Case 92c (WS2)
test("footer shows the all-rights-reserved notice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(NOTICE);
});

// Case 92d (WS2)
test("rain canvas does not intercept clicks", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const rain = page.locator(RAIN);
  await expect(rain).toBeAttached({ timeout: 5_000 });
  const pointerEvents = await rain.evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointerEvents).toBe("none");

  // Hit-testing at a few points never lands on the canvas.
  const hits = await rain.evaluate((el) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const points: [number, number][] = [
      [5, 5],
      [w / 2, h / 2],
      [w - 5, h - 5],
      [5, h - 5],
    ];
    return points.map(([x, y]) => document.elementFromPoint(x, y) === el);
  });
  expect(hits).toEqual([false, false, false, false]);
});

// Blue mode keeps the rain falling (a little slower), even scrolled past the hero.
test("rain keeps falling in blue mode", async ({ page }) => {
  await page.goto("/?pill=blue");
  await page.waitForLoadState("load");
  const rain = page.locator(RAIN);
  await expect(rain).toHaveAttribute("data-mode", /^(worker|main-thread)$/, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await page.waitForTimeout(600);
  const first = await rain.screenshot({ animations: "disabled" });
  await page.waitForTimeout(1_000);
  const second = await rain.screenshot({ animations: "disabled" });
  expect(first.equals(second)).toBe(false);
});
