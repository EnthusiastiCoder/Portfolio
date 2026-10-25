import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The plan does not name the intro overlay; the implementer must give it this test id.
const INTRO = '[data-testid="matrix-intro"]';
const LIVE = '[aria-live="polite"]';
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SECTION_HEADINGS = [/about/i, /experience/i, /projects/i, /skills/i, /contact/i];

type Mode = "red" | "blue";

function redPill(page: Page): Locator {
  return page.getByRole("button", { name: /red pill/i });
}

function bluePill(page: Page): Locator {
  return page.getByRole("button", { name: /blue pill/i });
}

function scenePill(page: Page, mode: Mode): Locator {
  return mode === "red" ? redPill(page) : bluePill(page);
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

/** Waits until any glitch transition has finished. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator("html")).not.toHaveAttribute("data-glitch", /.*/);
}

/** Asserts the mode is applied: attribute, URL, and CSS gating of [data-show] variants. */
async function expectMode(page: Page, mode: Mode): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-pill", mode);
  await expect(page).toHaveURL(new RegExp(`[?&]pill=${mode}(&|#|$)`));
  await settled(page);
  await expect(
    page.locator(`[data-show~="${mode}"]`).filter({ visible: true }).first(),
  ).toBeVisible();
  const shownOthers = await page
    .locator(`[data-show]:not([data-show~="${mode}"])`)
    .evaluateAll((els) => els.filter((el) => (el as HTMLElement).checkVisibility()).length);
  expect(shownOthers, `variants not for ${mode} that are still visible`).toBe(0);
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

// E1 (WS1): the depth/surface modes. Replaces 105c (pills no longer change data-effects).
for (const mode of ["red", "blue"] as const) {
  test(`${mode} pill applies ${mode} mode, writes ?pill=${mode} and gates [data-show] variants`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await scenePill(page, mode).click();
    await expectMode(page, mode);
    await expect(page.locator("html")).toHaveAttribute("data-pill-chosen", "true");
    await expect(scenePill(page, mode)).toHaveAttribute("aria-pressed", "true");
  });
}

test("an explicit choice persists across reload", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await redPill(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-pill", "red");
  expect(await page.evaluate(() => localStorage.getItem("matrix-pill"))).toBe("red");

  await page.reload();
  await page.waitForLoadState("load");
  await expect(page.locator("html")).toHaveAttribute("data-pill", "red");
  await expect(page.locator("html")).toHaveAttribute("data-pill-chosen", "true");
  await expect(redPill(page)).toHaveAttribute("aria-pressed", "true");
});

test("data-effects stays full after red and after blue (glitches in both modes)", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-effects", "full");

  await redPill(page).click();
  await expect(html).toHaveAttribute("data-pill", "red");
  await settled(page);
  await expect(html).toHaveAttribute("data-effects", "full");

  await bluePill(page).click();
  await expect(html).toHaveAttribute("data-pill", "blue");
  await settled(page);
  await expect(html).toHaveAttribute("data-effects", "full");
});

test("visiting /?pill=blue starts in blue mode with the blue pill pressed", async ({ page }) => {
  await page.goto("/?pill=blue");
  await page.waitForLoadState("load");
  await expect(page.locator("html")).toHaveAttribute("data-pill", "blue");
  await expect(bluePill(page)).toHaveAttribute("aria-pressed", "true");
  await expect(redPill(page)).toHaveAttribute("aria-pressed", "false");
});

test("scrolling past the scene without a choice gives both, announced but not stored", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-pill-chosen", /.*/);
  const before = await liveText(page);

  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const about = document.getElementById("about");
    if (about) window.scrollTo(0, about.getBoundingClientRect().top + window.scrollY);
  });

  await expect(html).toHaveAttribute("data-pill", "both");
  await expect.poll(() => liveText(page)).not.toBe(before);
  expect(await liveText(page)).not.toBe("");
  await expect(page.locator("#me")).toBeVisible();
  await expect(html).not.toHaveAttribute("data-pill-chosen", /.*/);
  expect(await page.evaluate(() => localStorage.getItem("matrix-pill"))).toBeNull();
  expect(new URL(page.url()).search).not.toContain("pill=");
});

// The navbar has no pill toggle any more: the hero pills are the only switch.
test("the navbar has no pill toggle; the hero red pill switches and updates the URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await expect(page.getByRole("group", { name: "Pill mode" })).toHaveCount(0);
  await expect(page.locator("header").getByRole("radio")).toHaveCount(0);

  await redPill(page).click();
  await expectMode(page, "red");
  await expect(redPill(page)).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("pill")).toBe("red");
  expect(await page.evaluate(() => localStorage.getItem("matrix-pill"))).toBe("red");
});

// E1 (WS1): rewrite of 105e, asserting data-pill instead of data-effects.
test("no WCAG 2.1 A/AA violations in red, blue and both", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  const html = page.locator("html");

  await redPill(page).click();
  await expect(html).toHaveAttribute("data-pill", "red");
  await settled(page);
  expect(await axeViolations(page)).toEqual([]);

  await bluePill(page).click();
  await expect(html).toHaveAttribute("data-pill", "blue");
  await settled(page);
  expect(await axeViolations(page)).toEqual([]);

  await page.goto("/?pill=both");
  await page.waitForLoadState("load");
  await expect(html).toHaveAttribute("data-pill", "both");
  await settled(page);
  expect(await axeViolations(page)).toEqual([]);
});
