import { test, expect, type Page } from "@playwright/test";

// T30-T34: scroll choreography, reduced-motion fallback, native scrolling, section nav, cursor.

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page, pill: "red" | "blue" | "both"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
}

/** Scrolls the whole page top to bottom in viewport-sized steps, then waits a beat. */
async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 700) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(300);
}

test.describe("choreography (T30)", () => {
  test("home uses at least 5 distinct data-enter entrances", async ({ page }) => {
    await open(page, "blue");
    const values = await page
      .locator("[data-enter]")
      .evaluateAll((els) => Array.from(new Set(els.map((e) => e.getAttribute("data-enter")))));
    expect(values.length, `data-enter values: ${values.join(",")}`).toBeGreaterThanOrEqual(5);
  });

  test("blue pins the product stage with position: sticky", async ({ page }) => {
    await open(page, "blue");
    const pin = page.locator("[data-stage-pin]").first();
    await expect(pin).toBeAttached();
    expect(await pin.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  });

  test("at mid-stage two adjacent product layers have different scales", async ({ page }) => {
    await open(page, "blue");
    const stage = page.locator("[data-product-stage]").first();
    await expect(stage).toBeAttached();
    const mid = await stage.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return window.scrollY + r.top + (r.height - window.innerHeight) / 2;
    });
    await page.evaluate((to) => window.scrollTo(0, to), mid);
    await page.waitForTimeout(400);

    const scales = await page.locator("[data-stage-layer]").evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        let s = 1;
        if (cs.scale && cs.scale !== "none") s *= parseFloat(cs.scale.split(" ")[0]);
        if (cs.transform && cs.transform !== "none") {
          const m = new DOMMatrixReadOnly(cs.transform);
          s *= Math.hypot(m.a, m.b);
        }
        return s;
      }),
    );
    expect(scales.length, "product layers").toBeGreaterThanOrEqual(5);
    let maxDiff = 0;
    for (let i = 1; i < scales.length; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(scales[i] - scales[i - 1]));
    }
    expect(maxDiff, `layer scales ${scales.join(", ")}`).toBeGreaterThan(0.05);
  });
});

test.describe("reduced motion (T31)", () => {
  test.use({ reducedMotion: "reduce" });

  test("every entrance ends visible and untransformed", async ({ page }) => {
    await open(page, "blue");
    await scrollThrough(page);
    const states = await page.locator("[data-enter]").evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return { enter: el.getAttribute("data-enter"), opacity: cs.opacity, transform: cs.transform };
      }),
    );
    expect(states.length).toBeGreaterThan(0);
    for (const s of states) {
      expect(s.opacity, `[data-enter="${s.enter}"] opacity`).toBe("1");
      expect(s.transform, `[data-enter="${s.enter}"] transform`).toBe("none");
    }
  });

  test("the product stage is not sticky", async ({ page }) => {
    await open(page, "blue");
    const pin = page.locator("[data-stage-pin]").first();
    await expect(pin).toBeAttached();
    expect(await pin.evaluate((el) => getComputedStyle(el).position)).not.toBe("sticky");
  });
});

test.describe("native scrolling (T32)", () => {
  test("mouse wheel scrolls within 500 ms", async ({ page }) => {
    await open(page, "blue");
    await page.mouse.move(720, 450);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 500 }).toBeGreaterThan(0);
  });

  test("PageDown scrolls", async ({ page }) => {
    await open(page, "blue");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("PageDown");
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 2_000 }).toBeGreaterThan(0);
  });
});

test.describe("section nav (T33)", () => {
  test('desktop nav[aria-label="Sections"] links the 5 sections', async ({ page }) => {
    await open(page, "blue");
    const hrefs = await page
      .locator('nav[aria-label="Sections"] a[href^="#"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    expect(hrefs).toEqual(["#about", "#projects", "#experience", "#skills", "#contact"]);
  });
});

test.describe("custom cursor (T34)", () => {
  test("blue adds a non-interactive [data-cursor] and keeps the native cursor", async ({ page }) => {
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
