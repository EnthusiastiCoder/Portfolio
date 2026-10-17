import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const RAIN = '[data-testid="matrix-rain"]';
// The plan does not name the intro overlay; the implementer must give it this test id.
const INTRO = '[data-testid="matrix-intro"]';
const LIVE = '[aria-live="polite"]';
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SECTION_HEADINGS = [/about/i, /experience/i, /projects/i, /skills/i, /contact/i];

function redPill(page: Page): Locator {
  return page.getByRole("button", { name: /red pill/i });
}

function bluePill(page: Page): Locator {
  return page.getByRole("button", { name: /blue pill/i });
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
}

async function liveText(page: Page): Promise<string> {
  const texts = await page.locator(LIVE).allTextContents();
  return texts.join("|").trim();
}

/** Press Tab until `target` has focus; fails if it is not reached within `max` presses. */
async function tabTo(page: Page, target: Locator, max = 60): Promise<void> {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("target was not reachable with Tab");
}

// Case 105a (WS2, rev 4)
test("content is visible at domcontentloaded before any pill choice", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const h1 = page.locator("h1").first();
  await expect(h1).toBeVisible();
  expect(await h1.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  for (const name of SECTION_HEADINGS) {
    await expect(page.getByRole("heading", { name }).first(), String(name)).toBeVisible();
  }
});

// Case 105b (WS2, rev 4)
test("pills are Tab-reachable buttons that activate with Enter and Space", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const red = redPill(page);
  const blue = bluePill(page);
  await expect(red).toHaveCount(1);
  await expect(blue).toHaveCount(1);
  await expect(red).toHaveAttribute("type", "button");
  await expect(blue).toHaveAttribute("type", "button");

  await tabTo(page, blue);
  await page.keyboard.press("Enter");
  await expect(blue).toHaveAttribute("aria-pressed", "true");
  await expect(red).toHaveAttribute("aria-pressed", "false");

  await tabTo(page, red);
  await page.keyboard.press("Space");
  await expect(red).toHaveAttribute("aria-pressed", "true");
  await expect(blue).toHaveAttribute("aria-pressed", "false");

  await blue.focus();
  await page.keyboard.press("Space");
  await expect(blue).toHaveAttribute("aria-pressed", "true");
  await expect(red).toHaveAttribute("aria-pressed", "false");

  await red.focus();
  await page.keyboard.press("Enter");
  await expect(red).toHaveAttribute("aria-pressed", "true");
  await expect(blue).toHaveAttribute("aria-pressed", "false");
});

// Case 105c (WS2, rev 4)
test("blue sets calm and static rain, red sets full, each is announced and persists", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const html = page.locator("html");
  await expect(page.locator(LIVE).first()).toBeAttached();

  const before = await liveText(page);
  await bluePill(page).click();
  await expect(html).toHaveAttribute("data-effects", "calm");
  await expect(page.locator(RAIN)).toHaveAttribute("data-mode", "static", { timeout: 5_000 });
  await expect.poll(() => liveText(page)).not.toBe(before);
  const afterBlue = await liveText(page);

  await page.reload();
  await page.waitForLoadState("load");
  await expect(html).toHaveAttribute("data-effects", "calm");
  await expect(bluePill(page)).toHaveAttribute("aria-pressed", "true");

  await redPill(page).click();
  await expect(html).toHaveAttribute("data-effects", "full");
  await expect.poll(() => liveText(page)).not.toBe(afterBlue);
  const afterRed = await liveText(page);
  expect(afterRed).not.toBe("");

  await page.reload();
  await page.waitForLoadState("load");
  await expect(html).toHaveAttribute("data-effects", "full");
  await expect(redPill(page)).toHaveAttribute("aria-pressed", "true");
});

// Case 105d (WS2, rev 4)
test("any intro overlay is aria-hidden and gone within 2 s", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const intro = page.locator(INTRO);
  if ((await intro.count()) > 0) {
    await expect(intro.first()).toHaveAttribute("aria-hidden", "true");
  }
  // toBeHidden passes when the element is removed or no longer shown.
  await expect(intro.first()).toBeHidden({ timeout: 2_000 });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  // Case 105d (WS2, rev 4)
  test("no intro element exists and the default effects level is calm", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await expect(page.locator(INTRO)).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-effects", "calm");
  });
});
