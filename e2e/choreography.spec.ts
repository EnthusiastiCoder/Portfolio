import { test, expect, type Page } from "@playwright/test";
import { siteConfig } from "../src/config/site";

// T30-T34: scroll choreography, reduced-motion fallback, native scrolling, section nav, cursor.

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page, pill: "red" | "blue" | "both"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
}

/** Resolves after two animation frames: one to run observers, one to paint. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

/** Scrolls the whole page top to bottom in viewport-sized steps, a frame pair per step. */
async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 700) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await frames(page);
  }
}

test.describe("choreography (T30)", () => {
  test("home uses at least 5 distinct data-enter entrances", async ({ page }) => {
    await open(page, "blue");
    const values = await page
      .locator("[data-enter]")
      .evaluateAll((els) => Array.from(new Set(els.map((e) => e.getAttribute("data-enter")))));
    expect(values.length, `data-enter values: ${values.join(",")}`).toBeGreaterThanOrEqual(5);
  });

  for (const pill of ["red", "blue", "both"] as const) {
    test(`${pill} pins the project deck with position: sticky`, async ({ page }) => {
      await open(page, pill);
      const pin = page.locator("[data-deck-pin]").first();
      await expect(pin).toBeAttached();
      expect(await pin.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    });
  }

  test("at mid-peel 1 to 2 the front two deck cards have different transforms", async ({
    page,
  }) => {
    await open(page, "blue");
    const deck = page.locator("[data-deck]").first();
    await expect(deck).toBeAttached();
    // Mid-peel from card i to i+1 sits at (i + 0.75) / (n - 1) of the deck's travel.
    const mid = await deck.evaluate((el: HTMLElement) => {
      const n = el.querySelectorAll("article[data-deck-card]").length;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const travel = el.offsetHeight - window.innerHeight;
      return top + (travel * 0.75) / (n - 1);
    });
    await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), mid);

    const cards = () =>
      page.locator("[data-deck-card]").evaluateAll((els) =>
        els.map((el) => {
          const cs = getComputedStyle(el);
          let s = 1;
          let tx = 0;
          let ty = 0;
          if (cs.scale && cs.scale !== "none") s *= parseFloat(cs.scale.split(" ")[0]);
          if (cs.transform && cs.transform !== "none") {
            const m = new DOMMatrixReadOnly(cs.transform);
            s *= Math.hypot(m.m11, m.m12, m.m13);
            tx = m.m41;
            ty = m.m42;
          }
          return { s, tx, ty };
        }),
      );
    expect(await cards(), "deck cards").toHaveLength(5);
    // The scroll-driven deck catches up within a few frames.
    await expect
      .poll(
        async () => {
          const [a, b] = await cards();
          return (
            Math.abs(a.s - b.s) > 0.05 || Math.abs(a.tx - b.tx) > 20 || Math.abs(a.ty - b.ty) > 20
          );
        },
        { message: "card 0 and card 1 transforms differ at mid-peel" },
      )
      .toBe(true);
  });
});

test.describe("reduced motion (T31)", () => {
  test.use({ reducedMotion: "reduce" });

  test("every entrance ends visible and untransformed", async ({ page }) => {
    await open(page, "blue");
    await scrollThrough(page);
    // Every entrance settles: lists the ones still hidden or moved until none are left.
    await expect
      .poll(() =>
        page.locator("[data-enter]").evaluateAll((els) =>
          els.length === 0
            ? ["no [data-enter] elements"]
            : els
                .map((el) => {
                  const cs = getComputedStyle(el);
                  const enter = el.getAttribute("data-enter");
                  if (cs.opacity !== "1") return `[data-enter="${enter}"] opacity ${cs.opacity}`;
                  if (cs.transform !== "none")
                    return `[data-enter="${enter}"] transform ${cs.transform}`;
                  return "";
                })
                .filter(Boolean),
        ),
      )
      .toEqual([]);
  });

  test("the project deck is not sticky", async ({ page }) => {
    await open(page, "blue");
    const pin = page.locator("[data-deck-pin]").first();
    await expect(pin).toBeAttached();
    expect(await pin.evaluate((el) => getComputedStyle(el).position)).not.toBe("sticky");
  });
});

test.describe("native scrolling (T32)", () => {
  test("mouse wheel scrolls within 500 ms", async ({ page }) => {
    await open(page, "blue");
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 800);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 500 })
      .toBeGreaterThan(0);
  });

  test("PageDown scrolls", async ({ page }) => {
    await open(page, "blue");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 2_000 })
      .toBeGreaterThan(0);
  });
});

test.describe("section nav (T33)", () => {
  test('desktop nav[aria-label="Sections"] links every shown section', async ({ page }) => {
    await open(page, "blue");
    const hrefs = await page
      .locator('nav[aria-label="Sections"] a[href^="#"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(hrefs).toEqual([
      "#about",
      "#projects",
      ...(siteConfig.showExperience ? ["#experience"] : []),
      "#skills",
      "#contact",
    ]);
  });
});

test.describe("custom cursor (T34)", () => {
  test("blue adds a non-interactive [data-cursor] and keeps the native cursor", async ({
    page,
  }) => {
    await open(page, "blue");
    const cursor = page.locator("[data-cursor]").first();
    await expect(cursor).toBeAttached();
    expect(await cursor.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    const native = await page.evaluate(() => [
      getComputedStyle(document.documentElement).cursor,
      getComputedStyle(document.body).cursor,
    ]);
    for (const c of native) expect(c).not.toBe("none");
  });

  test("red and both add the same [data-cursor] as blue", async ({ page }) => {
    for (const pill of ["red", "both"] as const) {
      await open(page, pill);
      const cursor = page.locator("[data-cursor]").first();
      await expect(cursor).toBeAttached();
      expect(await cursor.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
      const native = await page.evaluate(() => [
        getComputedStyle(document.documentElement).cursor,
        getComputedStyle(document.body).cursor,
      ]);
      for (const c of native) expect(c).not.toBe("none");
    }
  });
});
