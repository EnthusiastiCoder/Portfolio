import { test, expect, type Page } from "@playwright/test";

// T28-T29: red (engineer) and blue (visitor) are different layouts, not a re-skin.

const SECTIONS = ["about", "projects", "experience", "skills", "contact"];
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
  test("red #projects shows 5 overview screens, each opening a large architecture diagram", async ({
    page,
  }) => {
    await open(page, "red");
    const screens = page.locator("#projects article.pj:visible");
    await expect(screens).toHaveCount(5);
    const button = screens.first().locator(".pj-open");
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const diagram = page.locator("dialog.pd[open] svg[data-diagram]");
    await expect(diagram).toBeVisible();
    const width = await diagram.evaluate((el) => el.getBoundingClientRect().width);
    expect(width, "diagram fills most of a 1440 px view").toBeGreaterThan(1100);
  });

  test("blue #projects shows at least 4 large loaded images", async ({ page }) => {
    await open(page, "blue");
    const box = await page.locator("#projects").boundingBox();
    expect(box, "#projects box").not.toBeNull();
    const top = await page.evaluate(() => window.scrollY);
    for (let y = top + box!.y; y < top + box!.y + box!.height; y += 600) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(100);
    }
    await expect
      .poll(
        () =>
          // Blue now shows each product's demo as a <video poster> (T27): a
          // poster counts when it decodes at the demo's full 960 px capture
          // size; a screenshot <img> still needs 1000 px.
          page.locator("#projects").evaluate(async (root) => {
            const media = Array.from(root.querySelectorAll("img, video[poster]"));
            const loaded = await Promise.all(
              media.map(async (el) => {
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                if (r.width <= 0 || r.height <= 0 || cs.visibility === "hidden") return false;
                if (el instanceof HTMLImageElement) return el.complete && el.naturalWidth >= 1000;
                const poster = new Image();
                poster.src = (el as HTMLVideoElement).poster;
                try {
                  await poster.decode();
                } catch {
                  return false;
                }
                return poster.naturalWidth >= 960;
              }),
            );
            return loaded.filter(Boolean).length;
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(4);
  });
});
