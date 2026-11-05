import { test, expect, type Page } from "@playwright/test";
import { siteConfig } from "../src/config/site";

// T28-T29: red (engineer) and blue (visitor) are different layouts, not a re-skin.

const SECTIONS = [
  "about",
  "projects",
  ...(siteConfig.showExperience ? ["experience"] : []),
  "skills",
  "contact",
];
const RED_ONLY = '[data-show~="red"]:not([data-show~="blue"])';
const BLUE_ONLY = '[data-show~="blue"]:not([data-show~="red"])';

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page, pill: "red" | "blue" | "both"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
}

/** Visible text of the visible red-only / blue-only subtrees in a section. */
async function visibleVariants(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  await section.scrollIntoViewIfNeeded();
  return section.evaluate(
    (root, sel) => {
      const visible = (el: Element) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      const collect = (s: string) =>
        Array.from(root.querySelectorAll(s))
          .filter(visible)
          .map((el) => (el as HTMLElement).innerText.trim());
      return {
        red: collect(sel.red),
        blue: collect(sel.blue),
        text: (root as HTMLElement).innerText,
      };
    },
    { red: RED_ONLY, blue: BLUE_ONLY },
  );
}

test.describe("mode layouts (T28)", () => {
  for (const id of SECTIONS) {
    test(`#${id}: red and blue show different visible subtrees`, async ({ page }) => {
      await open(page, "red");
      const red = await visibleVariants(page, id);
      expect(red.red.length, "red shows a red-only subtree").toBeGreaterThan(0);
      expect(red.blue.length, "red hides blue-only subtrees").toBe(0);

      await open(page, "blue");
      const blue = await visibleVariants(page, id);
      expect(blue.blue.length, "blue shows a blue-only subtree").toBeGreaterThan(0);
      expect(blue.red.length, "blue hides red-only subtrees").toBe(0);

      expect(red.text).not.toBe(blue.text);
    });

    // Green (no pill, stored as "both") keeps every section, each with a visible green variant.
    test(`#${id}: green shows its own variant of the section`, async ({ page }) => {
      await open(page, "both");
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section.locator('[data-show~="both"]:visible').first()).toBeVisible();
    });
  }

  test("#projects h3 uses the same sans font in red and blue", async ({ page }) => {
    const firstFamily = async () => {
      const h3 = page.locator("#projects h3:visible").first();
      await h3.scrollIntoViewIfNeeded();
      const family = await h3.evaluate((el) => getComputedStyle(el).fontFamily);
      return family.split(",")[0].replace(/["']/g, "").trim();
    };
    await open(page, "red");
    const red = await firstFamily();
    expect(red).not.toMatch(/mono/i);

    await open(page, "blue");
    const blue = await firstFamily();
    expect(blue).not.toMatch(/mono/i);
    expect(red, "red shares blue's heading font").toBe(blue);
  });
});

test.describe("project media per mode (T29)", () => {
  /** Scrolls the deck to card i's hold position (the still part of its segment). */
  async function holdCard(page: Page, i: number): Promise<void> {
    await page.evaluate((index) => {
      const deck = document.querySelector<HTMLElement>("[data-deck]")!;
      const n = deck.querySelectorAll("article[data-deck-card]").length;
      const top = deck.getBoundingClientRect().top + window.scrollY;
      const travel = deck.offsetHeight - window.innerHeight;
      const p = Math.min(index + 0.2, n - 1);
      window.scrollTo({ top: top + (travel * p) / (n - 1), behavior: "instant" });
    }, i);
    await page.waitForTimeout(250);
  }

  test("red #projects shows 5 overview screens, each opening a large architecture diagram", async ({
    page,
  }) => {
    await open(page, "red");
    const screens = page.locator("#projects article[data-deck-card]");
    await expect(screens).toHaveCount(5);
    await holdCard(page, 0);
    const button = page.locator("#projects article[data-deck-card][data-current] .pj-open");
    await expect(button).toHaveCount(1);
    await button.click();
    const diagram = page.locator("dialog.pd[open] svg[data-diagram]");
    await expect(diagram).toBeVisible();
    const width = await diagram.evaluate((el) => el.getBoundingClientRect().width);
    expect(width, "diagram fills most of a 1440 px view").toBeGreaterThan(1100);
  });

  test("blue #projects shows at least 4 large loaded images", async ({ page }) => {
    await open(page, "blue");
    const srcs = new Set<string>();
    for (let i = 0; i < 5; i++) {
      await holdCard(page, i);
      // The current card's fan: 3 usage shots, each visible and decoded at full size.
      await expect
        .poll(
          () =>
            page
              .locator("#projects article[data-deck-card][data-current] [data-fan-card] img")
              .evaluateAll((imgs) =>
                imgs
                  .filter((img) => {
                    const el = img as HTMLImageElement;
                    const r = el.getBoundingClientRect();
                    const cs = getComputedStyle(el);
                    return (
                      r.width > 0 &&
                      r.height > 0 &&
                      cs.visibility !== "hidden" &&
                      cs.display !== "none" &&
                      el.complete &&
                      el.naturalWidth >= 1000
                    );
                  })
                  .map(
                    (img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src,
                  ),
              ),
          { timeout: 15_000, message: `card ${i} fan images loaded` },
        )
        .toHaveLength(3);
      const now = await page
        .locator("#projects article[data-deck-card][data-current] [data-fan-card] img")
        .evaluateAll((imgs) =>
          imgs.map((img) => (img as HTMLImageElement).getAttribute("src") ?? ""),
        );
      for (const s of now) srcs.add(s);
    }
    expect(srcs.size, `distinct loaded shots: ${[...srcs].join(", ")}`).toBeGreaterThanOrEqual(4);
    expect(srcs.size).toBe(15);
  });
});
