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
