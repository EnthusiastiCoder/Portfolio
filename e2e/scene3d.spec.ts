import { test, expect, type Page } from "@playwright/test";

// WS2 three-scene-and-budget: T17-T18.
// Contract: the 3D scene container inside #top gets data-scene-ready="true" after its first frame.

const READY = '#top [data-scene-ready="true"]';

/** Counts window.requestAnimationFrame calls from the first script on. */
async function countRaf(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __rafCalls: number };
    w.__rafCalls = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      w.__rafCalls += 1;
      return original(cb);
    };
  });
}

const rafCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __rafCalls: number }).__rafCalls);

// T17
test("the 3D scene mounts a canvas inside #top and becomes ready", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await expect(page.locator("#top canvas").first()).toBeAttached();
  await expect(page.locator(READY)).toHaveCount(1, { timeout: 15_000 });
  const canvas = page.locator("#top canvas").first();
  const hidden = await canvas.evaluate((el) => el.closest('[aria-hidden="true"]') !== null);
  expect(hidden, "canvas is inside an aria-hidden container").toBe(true);
});

// T17
test("the pill buttons stay real, keyboard-activatable buttons over the scene", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await expect(page.locator(READY)).toHaveCount(1, { timeout: 15_000 });
  const red = page.getByRole("button", { name: /red pill/i });
  const blue = page.getByRole("button", { name: /blue pill/i });
  await expect(red).toHaveCount(1);
  await expect(blue).toHaveCount(1);
  expect(await red.evaluate((el) => el.tagName)).toBe("BUTTON");
  expect(await blue.evaluate((el) => el.tagName)).toBe("BUTTON");
  // Neither button lives inside the canvas or an aria-hidden layer.
  for (const b of [red, blue]) {
    expect(await b.evaluate((el) => el.closest('[aria-hidden="true"]') === null)).toBe(true);
  }

  await red.focus();
  await page.keyboard.press("Enter");
  await expect(red).toHaveAttribute("aria-pressed", "true");
  await expect(blue).toHaveAttribute("aria-pressed", "false");

  await blue.focus();
  await page.keyboard.press("Space");
  await expect(blue).toHaveAttribute("aria-pressed", "true");
  await expect(red).toHaveAttribute("aria-pressed", "false");
});

// T17
test("scrolling past #top without choosing still yields both", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");
  await expect(page.locator(READY)).toHaveCount(1, { timeout: 15_000 });
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-pill-chosen", /.*/);
  await page.evaluate(() => {
    const about = document.getElementById("about");
    if (about) window.scrollTo(0, about.getBoundingClientRect().top + window.scrollY);
  });
  await expect(html).toHaveAttribute("data-pill", "both");
  await expect(html).not.toHaveAttribute("data-pill-chosen", /.*/);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  // T17
  test("renders a still frame and requests no further animation frames", async ({ page }) => {
    await countRaf(page);
    await page.goto("/");
    await page.waitForLoadState("load");
    await expect(page.locator(READY)).toHaveCount(1, { timeout: 15_000 });
    const before = await rafCalls(page);
    await page.waitForTimeout(1_000);
    const after = await rafCalls(page);
    expect(after - before, "rAF calls during 1 s after ready").toBeLessThanOrEqual(1);
  });
});

// T18
test("the canvas box keeps its height when the scene becomes ready (no CLS)", async ({ page }) => {
  // Records the canvas and #top heights the moment the canvas first appears, before any frame.
  await page.addInitScript(() => {
    const w = window as unknown as { __firstBox?: { canvas: number; top: number } };
    const grab = () => {
      const canvas = document.querySelector("#top canvas");
      const top = document.getElementById("top");
      if (!canvas || !top || w.__firstBox) return false;
      w.__firstBox = {
        canvas: canvas.getBoundingClientRect().height,
        top: top.getBoundingClientRect().height,
      };
      return true;
    };
    new MutationObserver((_m, obs) => {
      if (grab()) obs.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");
  await expect(page.locator(READY)).toHaveCount(1, { timeout: 15_000 });
  const first = await page.evaluate(
    () => (window as unknown as { __firstBox?: { canvas: number; top: number } }).__firstBox,
  );
  expect(first, "canvas measured when first attached").toBeDefined();
  const after = await page.evaluate(() => ({
    canvas: document.querySelector("#top canvas")!.getBoundingClientRect().height,
    top: document.getElementById("top")!.getBoundingClientRect().height,
  }));
  expect(first!.canvas).toBeGreaterThan(0);
  expect(Math.abs(after.canvas - first!.canvas)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.top - first!.top)).toBeLessThanOrEqual(1);
});
