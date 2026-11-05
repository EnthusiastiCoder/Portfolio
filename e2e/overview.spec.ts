import { test, expect, type Page } from "@playwright/test";

// The product overview (every mode): a short use case, 3 feature chips, one
// number and two actions beside the fan of usage shots, on one deck card that
// fits the screen at its hold position, in under about 40 words. Everything
// longer is in the detail.

const HEADER = 56;
const TOGGLES = 68;

async function open(page: Page, pill: "red" | "blue" | "both"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
}

/** Scrolls the deck to the hold position of the card with this heading (the still part of its segment). */
async function showOverview(page: Page, headingId: string) {
  await page.evaluate((id) => {
    const deck = document.querySelector<HTMLElement>("[data-deck]")!;
    const all = [...deck.querySelectorAll("article[data-deck-card]")];
    const i = all.indexOf(document.getElementById(id)!.closest("article[data-deck-card]")!);
    const n = all.length;
    const top = deck.getBoundingClientRect().top + window.scrollY;
    const travel = deck.offsetHeight - window.innerHeight;
    const p = Math.min(i + 0.2, n - 1);
    window.scrollTo({ top: top + (travel * p) / (n - 1), behavior: "instant" });
  }, headingId);
  // Let the scroll-driven deck catch up with the new position.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await page.waitForTimeout(200);
}

/** Geometry and visible text of one overview. */
async function measure(page: Page, headingId: string) {
  return page.evaluate((id) => {
    const ov = document.getElementById(id)!.closest(".ov") as HTMLElement;
    const copy = ov.querySelector(".ov-copy") as HTMLElement;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    // The fan's extent: the union of its rotated fan cards.
    const fanCards = [...ov.querySelectorAll(".ov-fan [data-fan-card]")].map(box);
    const fan = {
      top: Math.min(...fanCards.map((r) => r.top)),
      bottom: Math.max(...fanCards.map((r) => r.bottom)),
      left: Math.min(...fanCards.map((r) => r.left)),
      right: Math.max(...fanCards.map((r) => r.right)),
      height: 0,
    };
    fan.height = fan.bottom - fan.top;
    const figures = [...ov.querySelectorAll(".ov-figure")].filter(
      (el) => (el as HTMLElement).offsetParent !== null,
    );
    // The largest empty stretch inside the copy panel: above the first
    // child, between consecutive visible children, and below the last.
    const kids = [...copy.children]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => el.getBoundingClientRect());
    const inner = copy.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(copy).paddingTop);
    const edges = [inner.top + pad, ...kids.flatMap((r) => [r.top, r.bottom]), inner.bottom - pad];
    let maxGap = 0;
    for (let i = 0; i < edges.length; i += 2) maxGap = Math.max(maxGap, edges[i + 1] - edges[i]);
    return {
      maxGap,
      ov: box(ov),
      copy: box(copy),
      fan,
      fanCards: fanCards.length,
      words: copy.innerText.split(/\s+/).filter(Boolean).length,
      text: copy.innerText,
      chips: ov.querySelectorAll(".ov-features li").length,
      figures: figures.map((f) => (f as HTMLElement).innerText),
      viewport: window.innerHeight,
    };
  }, headingId);
}

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
]) {
  test.describe(`overview on ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pill of ["red", "blue", "both"] as const) {
      test(`${pill}: each overview fits one screen beside its fan, in under 40 words`, async ({
        page,
      }) => {
        await open(page, pill);
        for (const slug of ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"]) {
          await showOverview(page, `pj-${slug}`);
          const m = await measure(page, `pj-${slug}`);
          // One screen: the card starts under the header and ends above the toggle strip.
          const floor = m.viewport - (vp.name === "phone" ? TOGGLES : 0);
          expect(m.ov.top, `${slug} top`).toBeGreaterThanOrEqual(HEADER - 1);
          expect(m.ov.bottom, `${slug} bottom`).toBeLessThanOrEqual(floor + 1);
          expect(m.fanCards, `${slug} fan cards`).toBe(3);
          // Copy and fan never overlap.
          if (vp.name === "desktop") expect(m.copy.right).toBeLessThanOrEqual(m.fan.left);
          else expect(m.copy.bottom).toBeLessThanOrEqual(m.fan.top);
          expect(m.fan.height, `${slug} fan height`).toBeGreaterThan(m.ov.height * 0.3);
          expect(m.words, `${slug} words: ${m.text}`).toBeLessThan(40);
          expect(m.maxGap, `${slug} largest empty stretch in the copy`).toBeLessThanOrEqual(60);
          expect(m.chips, `${slug} chips`).toBe(3);
          expect(m.figures, `${slug} one number`).toHaveLength(1);
        }
      });
    }
  });
}

test.describe("overview content", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("red shows the measured figure, green the user-facing one", async ({ page }) => {
    await open(page, "red");
    await showOverview(page, "pj-nopload");
    expect((await measure(page, "pj-nopload")).figures[0]).toContain("about 27x");
    await open(page, "both");
    await showOverview(page, "pj-nopload");
    expect((await measure(page, "pj-nopload")).figures[0]).toContain(
      "Bytes uploaded while compressing a photo",
    );
  });

  test("the long text lives in the detail view, not the overview", async ({ page }) => {
    await open(page, "both");
    await showOverview(page, "pj-nopload");
    const text = (await measure(page, "pj-nopload")).text;
    for (const moved of ["Who it helps", "Skills it proves", "Source code"]) {
      expect(text).not.toContain(moved);
    }
    const ov = page.locator("article:has(#pj-nopload)");
    await ov.getByRole("button", { name: /how it's built/i }).click();
    const dialog = page.locator('dialog[data-project-detail="nopload"][open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Who it helps")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Skills it proves" })).toBeAttached();
  });

  test("the blue deck card shows the user-facing number", async ({ page }) => {
    await open(page, "blue");
    await showOverview(page, "pj-nopload");
    const card = page.locator("article:has(#pj-nopload)");
    await expect(card).toHaveAttribute("data-deck-card", "");
    await expect(card.locator(".ov-use")).toHaveText(
      "Shrink, convert or clean up photos without uploading them.",
    );
    await expect(card.locator(".ov-features li")).toHaveCount(3);
    await expect(card.locator(".ov-figure:visible")).toHaveCount(1);
    await expect(card.locator(".ov-figure:visible")).toContainText("Bytes uploaded");
    await expect(card.getByRole("link", { name: "Open Nopload" })).toBeAttached();
  });

  test("no video in the section, and every fan image loads lazily", async ({ page }) => {
    await open(page, "red");
    await expect(page.locator("#projects video")).toHaveCount(0);
    const loading = await page
      .locator("#projects .ov-fan img")
      .evaluateAll((els) => els.map((el) => el.getAttribute("loading")));
    expect(loading).toHaveLength(15);
    for (const l of loading) expect(l).toBe("lazy");
  });
});
