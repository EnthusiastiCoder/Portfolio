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
      return { red: collect(sel.red), blue: collect(sel.blue), text: (root as HTMLElement).innerText };
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

    test(`#${id}: both shows red and blue subtrees together`, async ({ page }) => {
      await open(page, "both");
      const both = await visibleVariants(page, id);
      expect(both.red.length, "red-only subtree visible in both").toBeGreaterThan(0);
      expect(both.blue.length, "blue-only subtree visible in both").toBeGreaterThan(0);
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
  test("red #projects shows at least 5 architecture diagrams", async ({ page }) => {
    await open(page, "red");
    const diagrams = page.locator("#projects svg[data-diagram]:visible");
    await page.locator("#projects").scrollIntoViewIfNeeded();
    expect(await diagrams.count()).toBeGreaterThanOrEqual(5);
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
          page.locator("#projects img").evaluateAll(
            (imgs) =>
              imgs.filter((img) => {
                const i = img as HTMLImageElement;
                const r = i.getBoundingClientRect();
                const cs = getComputedStyle(i);
                return (
                  i.complete &&
                  i.naturalWidth >= 1000 &&
                  r.width > 0 &&
                  r.height > 0 &&
                  cs.visibility !== "hidden"
                );
              }).length,
          ),
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(4);
  });
});
