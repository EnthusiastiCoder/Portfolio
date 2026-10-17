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
