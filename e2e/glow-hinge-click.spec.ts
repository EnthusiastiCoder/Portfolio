import { test, expect, type Page } from "@playwright/test";
import { frames, settle } from "./helpers/settle";

// plans/2026-11-24_pill-glow-card-hinge-open-buttons.md
// 1. The red and blue pills glow brighter on hover and brighter still while
//    pressed, in every mode; the figure itself (the "meet me" chest) never
//    glows: no green light on the body at rest or hovered.
// 2. The deck cards swing on a hinge, like the screenshot fan.
// 3. Every "Open product" button takes clicks: on the card in front, on a card
//    that is not in front, mid-scroll and mid-hinge, in every pill mode.

const READY = '#top [data-scene-ready="true"]';
const MODES = ["none", "red", "blue", "both"] as const;
type Mode = (typeof MODES)[number];

// Mean luminance of the 120x60 crop round each pill at rest, measured on the
// live site built from main (4014c0b, before this change) with the same clip,
// 1440x900, headless Chromium. The pills must never be dimmer than that.
const MAIN_REST: Record<Mode, { red: number; blue: number }> = {
  none: { red: 40.6, blue: 43.4 },
  red: { red: 44.9, blue: 37.5 },
  blue: { red: 35.0, blue: 47.5 },
  both: { red: 41.1, blue: 43.4 },
};

/**
 * A clearly visible step between two glow levels (mean luminance, 0..255).
 * The halo sits behind the figure, so the hand in the clip no longer lights
 * up; hover and selection measure about +8 over rest, not the old +10.
 */
const STEP = 6;

async function openHero(page: Page, mode: Mode): Promise<void> {
  await page.goto(mode === "none" ? "/" : `/?pill=${mode}`);
  await page.waitForSelector(READY, { timeout: 20_000 });
  // The custom cursor ring (accent green) follows the mouse; it is not part of
  // the figure, so it stays out of every sample.
  await page.addStyleTag({ content: ".breathing-cursor { display: none !important; }" });
  await page.mouse.move(5, 880);
}

type Stats = { lum: number; green: number };

/** Mean luminance and the count of green-dominant pixels in a screenshot clip. */
async function sample(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
): Promise<Stats> {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const blob = await (await fetch("data:image/png;base64," + b64)).blob();
    const bm = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bm.width, bm.height);
    const x = c.getContext("2d")!;
    x.drawImage(bm, 0, 0);
    const d = x.getImageData(0, 0, bm.width, bm.height).data;
    let l = 0;
    let green = 0;
    for (let i = 0; i < d.length; i += 4) {
      l += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      if (d[i + 1] > d[i] + 30 && d[i + 1] > d[i + 2] + 30) green++;
    }
    return { lum: l / (d.length / 4), green };
  }, png.toString("base64"));
}

type Clip = { x: number; y: number; width: number; height: number };

/**
 * Samples the clip once the glow has settled: every running CSS transition on
 * the page has finished (the scene redraws synchronously in still mode).
 * Replaces a fixed sleep after a hover, a press or a release.
 */
async function settled(page: Page, clip: Clip): Promise<Stats> {
  await frames(page);
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a instanceof CSSTransition)
          .map((a) => a.finished.catch(() => undefined)),
      ),
      new Promise((done) => setTimeout(done, 2_000)),
    ]),
  );
  await frames(page);
  return sample(page, clip);
}

test.describe("hero pill glow", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const mode of MODES) {
    test(`G1 ${mode}: the chest stays unlit, at rest and with the figure hovered`, async ({
      page,
    }) => {
      await openHero(page, mode);
      const me = (await page.locator(".pill-hit--me").boundingBox())!;
      const chest = {
        x: me.x + me.width * 0.3,
        y: me.y + me.height * 0.3,
        width: me.width * 0.4,
        height: me.height * 0.4,
      };
      const rest = await settled(page, chest);
      await page.mouse.move(me.x + me.width / 2, me.y + me.height / 2);
      const hover = await settled(page, chest);
      expect(rest.green, `${mode} chest at rest: green-dominant pixels`).toBe(0);
      expect(hover.green, `${mode} chest hovered: green-dominant pixels`).toBe(0);
      expect(
        Math.abs(hover.lum - rest.lum),
        `${mode} chest light: rest ${rest.lum} hover ${hover.lum}`,
      ).toBeLessThan(1);
    });

    for (const pill of ["red", "blue"] as const) {
      test(`G2 ${mode}/${pill}: at least main's glow at rest, brighter hovered, brightest pressed`, async ({
        page,
      }) => {
        await openHero(page, mode);
        const box = (await page.locator(`.pill-hit--${pill}`).boundingBox())!;
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const clip = { x: cx - 60, y: cy - 20, width: 120, height: 60 };
        const rest = await settled(page, clip);
        await page.mouse.move(cx, cy);
        const hover = await settled(page, clip);
        await page.mouse.down();
        const active = await settled(page, clip);
        await page.mouse.up();
        await page.mouse.move(5, 880);
        const selected = await settled(page, clip);
        const seen = `rest ${rest.lum} hover ${hover.lum} active ${active.lum} selected ${selected.lum}`;
        expect(
          rest.lum,
          `${mode}/${pill} rest vs main ${MAIN_REST[mode][pill]}: ${seen}`,
        ).toBeGreaterThanOrEqual(MAIN_REST[mode][pill]);
        expect(hover.lum, `${mode}/${pill} hover: ${seen}`).toBeGreaterThan(rest.lum + STEP);
        expect(active.lum, `${mode}/${pill} pressed: ${seen}`).toBeGreaterThan(hover.lum);
        // Clicking selects the pill: it keeps a glow above an unselected rest.
        if (mode !== pill) {
          expect(selected.lum, `${mode}/${pill} selected: ${seen}`).toBeGreaterThan(
            rest.lum + STEP,
          );
        }
      });
    }
  }
});

// ---- The deck ----

const N = 5;
const ORDER = ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"];
const CTA: Record<string, string> = {
  nopload: "Open Nopload",
  foreverqr: "Open ForeverQR",
  quietpdf: "Open QuietPDF",
  framelab: "Open Framelab",
  syncplay: "Get SyncPlay",
};

/** Scrolls to deck progress p (in cards, 0..N-1) and lets scroll-driven styles settle. */
async function scrollDeck(page: Page, p: number): Promise<void> {
  await page.evaluate(
    ([progress, n]) => {
      const deck = document.querySelector<HTMLElement>("[data-deck]")!;
      const top = deck.getBoundingClientRect().top + window.scrollY;
      const travel = deck.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + (travel * progress) / (n - 1), behavior: "instant" });
    },
    [p, N],
  );
  await frames(page);
  await settle(page, "#projects article[data-deck-card], #projects figure[data-fan-card]");
}

const hold = (i: number) => Math.min(i + 0.2, N - 1);
const midPeel = (i: number) => i + 0.75;

/** Each deck card's z-rotation in degrees and whether its transform is 3D. */
async function cardAngles(page: Page): Promise<{ deg: number; is3d: boolean }[]> {
  return page.locator("#projects article[data-deck-card]").evaluateAll((els) =>
    els.map((el) => {
      const t = getComputedStyle(el).transform;
      if (!t || t === "none") return { deg: 0, is3d: false };
      const m = new DOMMatrixReadOnly(t);
      return { deg: (Math.atan2(m.m12, m.m11) * 180) / Math.PI, is3d: t.startsWith("matrix3d") };
    }),
  );
}

async function openDeck(page: Page, mode: "red" | "blue" | "both"): Promise<void> {
  // The product links open other sites; answer them locally.
  await page.context().route(/^https?:\/\/(?!localhost)/, (r) => r.fulfill({ body: "ok" }));
  await page.goto(`/?pill=${mode}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", mode);
  await expect(page.locator("html")).toHaveAttribute("data-effects", "full");
}

/** Clicks the card's CTA like a user (Playwright refuses if anything covers it). */
async function clickCta(page: Page, slug: string, why: string): Promise<void> {
  const card = page.locator(`#projects article[data-deck-card]`).nth(ORDER.indexOf(slug));
  const cta = card.getByRole("link", { name: CTA[slug] });
  const [popup] = await Promise.all([
    page.waitForEvent("popup", { timeout: 5_000 }),
    cta.click({ timeout: 5_000 }),
  ]);
  expect(popup, `${why}: ${CTA[slug]} opened a tab`).toBeTruthy();
  await popup.close();
}

test.describe("deck hinge on desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("H1: the cards behind the front one hang tilted on the hinge, and the peel swings it", async ({
    page,
  }) => {
    await openDeck(page, "blue");
    await scrollDeck(page, hold(0));
    await page.mouse.move(1, 1);
    let a = await cardAngles(page);
    expect(Math.abs(a[0].deg), `front card at hold: ${a[0].deg}`).toBeLessThan(0.5);
    expect(a[1].deg, `card 1 behind: ${a[1].deg}`).toBeGreaterThan(1);
    expect(a[2].deg, `card 2 further behind: ${a[2].deg}`).toBeGreaterThan(a[1].deg);
    await scrollDeck(page, midPeel(0));
    a = await cardAngles(page);
    expect(a[0].is3d, "peeling card is in perspective").toBe(true);
    expect(a[0].deg, `peeling card swings on the hinge: ${a[0].deg}`).toBeLessThan(-1);
  });

  test("H2: hovering the deck swings the cards behind further out", async ({ page }) => {
    await openDeck(page, "blue");
    await scrollDeck(page, hold(0));
    await page.mouse.move(1, 1);
    await settle(page, "#projects article[data-deck-card]");
    const before = await cardAngles(page);
    const box = (await page.locator("#projects article[data-deck-card]").first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect
      .poll(async () => (await cardAngles(page))[1].deg - before[1].deg, {
        message: `card 1 swings out from ${before[1].deg} on hover`,
      })
      .toBeGreaterThan(1);
  });

  test("C1: in every pill mode the front card's Open button opens the product", async ({
    page,
  }) => {
    // Three page loads and nine popups: about 30 s on a machine with no GPU.
    test.slow();
    for (const mode of ["red", "blue", "both"] as const) {
      await openDeck(page, mode);
      for (const i of [0, 2, 4]) {
        await scrollDeck(page, hold(i));
        await clickCta(page, ORDER[i], `${mode} hold ${i}`);
      }
    }
  });

  for (const mode of ["red", "blue", "both"] as const) {
    test(`C2 ${mode}: mid-scroll, both the swinging card's and the rising card's Open buttons take clicks`, async ({
      page,
    }) => {
      await openDeck(page, mode);
      for (const i of [0, 2]) {
        for (const slug of [ORDER[i + 1], ORDER[i]]) {
          await scrollDeck(page, i + 0.6);
          const current = await page
            .locator("#projects article[data-deck-card]")
            .evaluateAll((els) => els.findIndex((el) => el.hasAttribute("data-current")));
          await clickCta(page, slug, `${mode} p=${i + 0.6} (current ${current})`);
        }
      }
    });
  }

  test("C3: a card that is not in front takes the click, and the page does not jump", async ({
    page,
  }) => {
    await openDeck(page, "blue");
    await scrollDeck(page, 0.6);
    const cardsLoc = page.locator("#projects article[data-deck-card]");
    const current = await cardsLoc.evaluateAll((els) =>
      els.findIndex((el) => el.hasAttribute("data-current")),
    );
    const other = current === 0 ? 1 : 0;
    const y = await page.evaluate(() => window.scrollY);
    await clickCta(page, ORDER[other], `non-current card ${other} (current ${current})`);
    expect(await page.evaluate(() => window.scrollY), "no scroll jump").toBe(y);
  });

  test("C4: with the deck hovered (cards swung out) the front Open button still takes the click", async ({
    page,
  }) => {
    await openDeck(page, "red");
    await scrollDeck(page, hold(1));
    const box = (await page.locator("#projects article[data-deck-card]").nth(1).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await settle(page, "#projects article[data-deck-card]");
    await clickCta(page, ORDER[1], "hovered deck, hold 1");
  });
});

test.describe("deck on phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("C5: the front card's Open button opens the product at every hold", async ({ page }) => {
    await openDeck(page, "blue");
    for (let i = 0; i < N; i++) {
      await scrollDeck(page, hold(i));
      await clickCta(page, ORDER[i], `phone hold ${i}`);
    }
  });
});
