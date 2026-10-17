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
