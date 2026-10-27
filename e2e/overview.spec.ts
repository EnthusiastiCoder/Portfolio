import { test, expect, type Page } from "@playwright/test";

// The product overview (every mode): a short use case, 3 feature chips, one
// number and two actions beside the demo frame, filling one screen with no
// empty band, in under about 40 words. Everything longer is in the detail.

const HEADER = 56;

async function open(page: Page, pill: "red" | "blue" | "both"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
}

/** Scrolls the overview with this heading to the top of the screen, under the header. */
async function showOverview(page: Page, headingId: string) {
  await page.evaluate(
    ([id, header]) => {
      const ov = document.getElementById(id as string)!.closest(".ov")!;
      const top = ov.getBoundingClientRect().top + window.scrollY - (header as number);
      window.scrollTo({ top, behavior: "instant" });
    },
    [headingId, HEADER],
  );
  // Let the scroll-driven entrances catch up with the new position.
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
    const demo = ov.querySelector(".ov-demo") as HTMLElement;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const figures = [...ov.querySelectorAll(".ov-figure")].filter(
      (el) => (el as HTMLElement).offsetParent !== null,
    );
    return {
      ov: box(ov),
      copy: box(copy),
      demo: box(demo),
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

    for (const pill of ["red", "both"] as const) {
      test(`${pill}: each overview fits one screen beside its demo, in under 40 words`, async ({
        page,
      }) => {
        await open(page, pill);
        for (const slug of ["nopload", "quietpdf", "syncplay"]) {
          await showOverview(page, `pj-${slug}`);
          const m = await measure(page, `pj-${slug}`);
          // One screen: the overview starts under the header and ends on screen.
          expect(m.ov.top, `${slug} top`).toBeGreaterThanOrEqual(HEADER - 1);
          expect(m.ov.bottom, `${slug} bottom`).toBeLessThanOrEqual(m.viewport + 1);
          // No empty band: the demo frame reaches the bottom of the overview.
          expect(m.ov.bottom - m.demo.bottom, `${slug} band under the demo`).toBeLessThan(40);
          // Copy and demo never overlap.
          if (vp.name === "desktop") expect(m.copy.right).toBeLessThanOrEqual(m.demo.left);
          else expect(m.copy.bottom).toBeLessThanOrEqual(m.demo.top);
          expect(m.demo.height, `${slug} demo height`).toBeGreaterThan(m.ov.height * 0.4);
          expect(m.words, `${slug} words: ${m.text}`).toBeLessThan(40);
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

  test("blue's stage shows the same overview with the user-facing number", async ({ page }) => {
    await open(page, "blue");
    const layer = page.locator("[data-stage-layer]").first();
    await layer.scrollIntoViewIfNeeded();
    await expect(layer.locator(".ov-use")).toHaveText(
      "Shrink, convert or clean up photos without uploading them.",
    );
    await expect(layer.locator(".ov-features li")).toHaveCount(3);
    await expect(layer.locator(".ov-figure")).toContainText("Bytes uploaded");
    await expect(layer.getByRole("link", { name: "Open Nopload" })).toBeAttached();
  });

  test("the demo frame never loads a video up front", async ({ page }) => {
    await open(page, "red");
    const videos = await page
      .locator("video[data-demo-video]")
      .evaluateAll((els) => els.map((v) => (v as HTMLVideoElement).getAttribute("preload")));
    for (const preload of videos) expect(preload).toBe("none");
  });
});
