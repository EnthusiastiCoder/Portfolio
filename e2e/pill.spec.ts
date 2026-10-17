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
