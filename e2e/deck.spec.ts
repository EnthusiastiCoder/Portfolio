import { test, expect, type Page } from "@playwright/test";
import { frames, settle } from "./helpers/settle";

// WS2 (plans/2026-11-23_projects-deck-redesign.md): the projects section is a
// "3D deck in a folder" in every mode. The section pins; each scroll segment
// holds the front card still, then peels it up and out in perspective while
// the next card rises. Each card frosts the rain (no opacity/filter/mask on it
// or any ancestor) and shows a fan of 3 usage shots on one shared hinge.
//
// Hooks: [data-deck], [data-deck-pin], article[data-deck-card] (data-current,
// data-near, --i), [data-fan], figure[data-fan-card] (--k), #pj-<slug>.

const HEADER = 56;
const TOGGLES = 68;
const N = 5;
const ORDER = ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"];
const CTA: Record<string, string> = {
  nopload: "Open Nopload",
  foreverqr: "Open ForeverQR",
  quietpdf: "Open QuietPDF",
  framelab: "Open Framelab",
  syncplay: "Get SyncPlay",
};
const MODES = ["red", "blue", "both"] as const;
type Mode = (typeof MODES)[number];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
] as const;

async function open(page: Page, pill: Mode, effects: "full" | "calm" = "full"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
  await expect(page.locator("html")).toHaveAttribute("data-effects", effects);
}

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

/** Hold position of card i: the first part of its segment, where nothing moves. */
const hold = (i: number) => Math.min(i + 0.2, N - 1);
/** Halfway through the move from card i to card i+1. */
const midPeel = (i: number) => i + 0.75;

type CardState = {
  current: boolean;
  near: boolean;
  top: number;
  bottom: number;
  left: number;
  right: number;
  transform: string;
  scale: number;
  identity: boolean;
};

/** Geometry and transform state of every deck card. */
async function cards(page: Page): Promise<CardState[]> {
  return page.locator("#projects article[data-deck-card]").evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      let scale = 1;
      if (cs.scale && cs.scale !== "none") scale *= parseFloat(cs.scale.split(" ")[0]);
      let identity = true;
      if (cs.transform && cs.transform !== "none") {
        const m = new DOMMatrixReadOnly(cs.transform);
        scale *= Math.hypot(m.m11, m.m12, m.m13);
        const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        const got = [
          m.m11,
          m.m12,
          m.m13,
          m.m14,
          m.m21,
          m.m22,
          m.m23,
          m.m24,
          m.m31,
          m.m32,
          m.m33,
          m.m34,
          m.m41,
          m.m42,
          m.m43,
          m.m44,
        ];
        identity = got.every((v, k) => Math.abs(v - id[k]) <= 0.01);
      }
      return {
        current: el.hasAttribute("data-current"),
        near: el.hasAttribute("data-near"),
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        transform: cs.transform,
        scale,
        identity,
      };
    }),
  );
}

type FanState = {
  angles: number[];
  centres: { x: number; y: number }[];
  hinges: { x: number; y: number }[];
  imgs: {
    complete: boolean;
    naturalWidth: number;
    naturalHeight: number;
    offsetWidth: number;
    offsetHeight: number;
    objectFit: string;
    visible: boolean;
    rect: { top: number; bottom: number; left: number; right: number };
  }[];
  card: { top: number; bottom: number; left: number; right: number };
  viewport: { width: number; height: number };
};

/** The fan in card i: each fan card's angle (rotate + transform), hinge, and its image. */
async function fan(page: Page, i: number): Promise<FanState> {
  return page
    .locator("#projects article[data-deck-card]")
    .nth(i)
    .evaluate((card) => {
      const parseRotate = (v: string) => {
        if (!v || v === "none") return 0;
        const m = v.trim().match(/(-?[\d.e+-]+)(deg|rad|turn|grad)$/);
        if (!m) return 0;
        const n = parseFloat(m[1]);
        return m[2] === "rad"
          ? (n * 180) / Math.PI
          : m[2] === "turn"
            ? n * 360
            : m[2] === "grad"
              ? n * 0.9
              : n;
      };
      const figs = [...card.querySelectorAll<HTMLElement>("figure[data-fan-card]")];
      const angles = figs.map((f) => {
        const cs = getComputedStyle(f);
        let a = parseRotate(cs.rotate);
        if (cs.transform && cs.transform !== "none") {
          const m = new DOMMatrixReadOnly(cs.transform);
          a += (Math.atan2(m.m12, m.m11) * 180) / Math.PI;
        }
        return a;
      });
      const hinges = figs.map((f) => {
        let x = 0;
        let y = 0;
        for (let el: HTMLElement | null = f; el; el = el.offsetParent as HTMLElement | null) {
          x += el.offsetLeft;
          y += el.offsetTop;
        }
        const [ox, oy] = getComputedStyle(f).transformOrigin.split(" ").map(parseFloat);
        return { x: x + ox, y: y + oy };
      });
      const imgs = figs.map((f) => f.querySelector("img")!);
      const centres = imgs.map((img) => {
        const r = img.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return {
        angles,
        centres,
        hinges,
        imgs: imgs.map((img) => {
          const cs = getComputedStyle(img);
          const r = img.getBoundingClientRect();
          return {
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            offsetWidth: img.offsetWidth,
            offsetHeight: img.offsetHeight,
            objectFit: cs.objectFit,
            visible:
              r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none",
            rect: box(img),
          };
        }),
        card: box(card),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    });
}

const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

/** Waits until card i's 3 fan images are loaded at full size. */
async function fanLoaded(page: Page, i: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const f = await fan(page, i);
        return f.imgs.filter((img) => img.complete && img.naturalWidth >= 1000).length;
      },
      { timeout: 15_000, message: `card ${i} fan images loaded` },
    )
    .toBe(3);
}

for (const vp of VIEWPORTS) {
  const phone = vp.name === "phone";
  const bottomLimit = (h: number) => h - (phone ? TOGGLES : 0);

  test.describe(`deck on ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("E1: in every mode the deck pins and holds 5 cards", async ({ page }) => {
      for (const mode of MODES) {
        await open(page, mode);
        await expect(page.locator("#projects article[data-deck-card]")).toHaveCount(5);
        const pin = page.locator("#projects [data-deck-pin]");
        await expect(pin).toHaveCount(1);
        expect(await pin.evaluate((el) => getComputedStyle(el).position), mode).toBe("sticky");
      }
    });

    test("E2: at each hold the front card is current, on screen and flat; the last one is peeled; the next peeks", async ({
      page,
    }) => {
      await open(page, "blue");
      for (let i = 0; i < N; i++) {
        await scrollDeck(page, hold(i));
        const all = await cards(page);
        const h = await page.evaluate(() => window.innerHeight);
        expect(
          all.map((c) => c.current),
          `hold ${i}: data-current`,
        ).toEqual(all.map((_, k) => k === i));
        const c = all[i];
        expect(c.top, `hold ${i}: card top`).toBeGreaterThanOrEqual(HEADER - 1);
        expect(c.bottom, `hold ${i}: card bottom`).toBeLessThanOrEqual(bottomLimit(h) + 1);
        expect(c.identity, `hold ${i}: card transform ${c.transform}`).toBe(true);
        if (i > 0) {
          expect(all[i - 1].bottom, `hold ${i}: card ${i - 1} peeled away`).toBeLessThanOrEqual(
            HEADER,
          );
        }
        if (i < N - 1) {
          expect(all[i + 1].scale, `hold ${i}: card ${i + 1} scale`).toBeLessThan(0.99);
          expect(all[i + 1].bottom, `hold ${i}: card ${i + 1} peeks below`).toBeGreaterThan(
            c.bottom,
          );
        }
      }
    });

    test("E3: mid-peel lifts the front card in perspective while the next one rises", async ({
      page,
    }) => {
      await open(page, "blue");
      for (const i of [0, 2]) {
        await scrollDeck(page, hold(i));
        const atHold = await cards(page);
        await scrollDeck(page, midPeel(i));
        const atMid = await cards(page);
        expect(atMid[i].transform, `card ${i} at mid-peel`).toMatch(/^matrix3d\(/);
        expect(atMid[i].top, `card ${i} moved up`).toBeLessThan(atHold[i].top - 50);
        const slot1 = atHold[i + 1].scale;
        expect(atMid[i + 1].scale, `card ${i + 1} rises past slot1 ${slot1}`).toBeGreaterThan(
          slot1,
        );
        expect(atMid[i + 1].scale, `card ${i + 1} not yet in front`).toBeLessThan(1);
      }
    });

    test("E4: every near card on screen frosts the rain: blur(12px), and nothing above it breaks the backdrop", async ({
      page,
    }) => {
      for (const mode of MODES) {
        await open(page, mode);
        for (const [label, p] of [
          ["hold 0", hold(0)],
          ["mid-peel 0 to 1", midPeel(0)],
          ["hold 2", hold(2)],
        ] as const) {
          await scrollDeck(page, p);
          const problems = await page
            .locator("#projects article[data-deck-card][data-near]")
            .evaluateAll((els) => {
              const out: string[] = [];
              const badKey = (k: string) => /^(opacity|filter|mask)/i.test(k);
              const animProblems = (el: Element, who: string) => {
                for (const a of el.getAnimations()) {
                  const effect = a.effect as KeyframeEffect | null;
                  const frames = effect?.getKeyframes?.() ?? [];
                  const keys = frames.flatMap((f) => Object.keys(f)).filter(badKey);
                  if (keys.length > 0) {
                    const name = (a as CSSAnimation).animationName ?? a.id;
                    out.push(`${who} animates ${[...new Set(keys)].join(",")} (${name})`);
                  }
                }
              };
              for (const el of els) {
                const r = el.getBoundingClientRect();
                if (r.bottom <= 0 || r.top >= window.innerHeight) continue;
                if (r.right <= 0 || r.left >= window.innerWidth) continue;
                const label = el.getAttribute("aria-labelledby");
                const cs = getComputedStyle(el);
                if (!cs.backdropFilter.includes("blur(12px)")) {
                  out.push(`${label} backdrop-filter ${cs.backdropFilter}`);
                }
                if (cs.opacity !== "1") out.push(`${label} opacity ${cs.opacity}`);
                animProblems(el, `${label}`);
                for (let a = el.parentElement; a; a = a.parentElement) {
                  const who = `${label} ancestor <${a.tagName.toLowerCase()}${a.id ? "#" + a.id : ""} class="${a.className}">`;
                  const s = getComputedStyle(a);
                  if (s.opacity !== "1") out.push(`${who} opacity ${s.opacity}`);
                  if (s.filter !== "none") out.push(`${who} filter ${s.filter}`);
                  if (s.maskImage !== "none") out.push(`${who} mask-image ${s.maskImage}`);
                  if (s.clipPath !== "none") out.push(`${who} clip-path ${s.clipPath}`);
                  if (s.mixBlendMode !== "normal")
                    out.push(`${who} mix-blend-mode ${s.mixBlendMode}`);
                  if (s.backdropFilter !== "none")
                    out.push(`${who} backdrop-filter ${s.backdropFilter}`);
                  animProblems(a, who);
                }
              }
              return out;
            });
          expect(problems, `${mode} ${label}`).toEqual([]);
        }
      }
    });

    test("E5: the fan holds 3 uncropped loaded shots on one shared hinge, spread along the viewport's long axis", async ({
      page,
    }) => {
      await open(page, "blue");
      for (const i of [0, 3]) {
        await scrollDeck(page, hold(i));
        await fanLoaded(page, i);
        const f = await fan(page, i);
        expect(f.imgs, `card ${i} fan images`).toHaveLength(3);
        f.imgs.forEach((img, k) => {
          const who = `card ${i} shot ${k + 1}`;
          expect(img.naturalWidth, `${who} naturalWidth`).toBeGreaterThanOrEqual(1000);
          const shown = img.offsetWidth / img.offsetHeight;
          const natural = img.naturalWidth / img.naturalHeight;
          expect(Math.abs(shown - natural), `${who} aspect ${shown} vs ${natural}`).toBeLessThan(
            0.02,
          );
          expect(img.objectFit, `${who} object-fit`).not.toBe("cover");
          expect(img.rect.left, `${who} left in card`).toBeGreaterThanOrEqual(f.card.left - 2);
          expect(img.rect.right, `${who} right in card`).toBeLessThanOrEqual(f.card.right + 2);
          expect(img.rect.top, `${who} top in card`).toBeGreaterThanOrEqual(f.card.top - 2);
          expect(img.rect.bottom, `${who} bottom in card`).toBeLessThanOrEqual(f.card.bottom + 2);
          expect(img.rect.left, `${who} left on screen`).toBeGreaterThanOrEqual(0);
          expect(img.rect.right, `${who} right on screen`).toBeLessThanOrEqual(f.viewport.width);
          expect(img.rect.top, `${who} top on screen`).toBeGreaterThanOrEqual(0);
          expect(img.rect.bottom, `${who} bottom on screen`).toBeLessThanOrEqual(f.viewport.height);
        });
        for (let a = 0; a < 3; a++) {
          for (let b = a + 1; b < 3; b++) {
            expect(
              Math.abs(f.angles[a] - f.angles[b]),
              `card ${i} angles ${f.angles.join(", ")}`,
            ).toBeGreaterThanOrEqual(4);
          }
        }
        const hx = f.hinges.map((h) => h.x);
        const hy = f.hinges.map((h) => h.y);
        expect(spread(hx), `card ${i} hinge x ${hx.join(", ")}`).toBeLessThanOrEqual(2);
        expect(spread(hy), `card ${i} hinge y ${hy.join(", ")}`).toBeLessThanOrEqual(2);
        const sx = spread(f.centres.map((c) => c.x));
        const sy = spread(f.centres.map((c) => c.y));
        if (phone) expect(sy, `card ${i} fans vertically (x ${sx}, y ${sy})`).toBeGreaterThan(sx);
        else expect(sx, `card ${i} fans horizontally (x ${sx}, y ${sy})`).toBeGreaterThan(sy);
      }
    });

    if (!phone) {
      test("E6: hovering the front card spreads its fan further", async ({ page }) => {
        await open(page, "blue");
        await scrollDeck(page, hold(0));
        await fanLoaded(page, 0);
        await page.mouse.move(1, 1);
        await settle(page, "#projects figure[data-fan-card]");
        const before = spread((await fan(page, 0)).angles);
        const box = await page.locator("#projects article[data-deck-card]").first().boundingBox();
        expect(box, "card box").not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
        await expect
          .poll(async () => spread((await fan(page, 0)).angles) - before, {
            message: `angle spread grows from ${before} on hover`,
          })
          .toBeGreaterThanOrEqual(4);
      });

      test("E7: Tab walks the deck in DOM order and focus brings its card to the front", async ({
        page,
      }) => {
        await open(page, "blue");
        await scrollDeck(page, hold(0));
        await page.locator("#pj-nopload .pj-open").focus();
        const cardsLoc = page.locator("#projects article[data-deck-card]");
        for (const [i, slug] of ORDER.entries()) {
          const card = cardsLoc.nth(i);
          const steps = [
            { name: `${slug} name`, loc: page.locator(`#pj-${slug} .pj-open`) },
            { name: CTA[slug], loc: card.getByRole("link", { name: CTA[slug] }) },
            {
              name: `${slug} How it's built`,
              loc: card.getByRole("button", { name: /how it's built/i }),
            },
          ];
          for (const [k, step] of steps.entries()) {
            if (i > 0 || k > 0) await page.keyboard.press("Tab");
            await expect(step.loc, `focus on ${step.name}`).toBeFocused();
            await expect(card, `${slug} comes to the front`).toHaveAttribute("data-current", "", {
              timeout: 1_000,
            });
            const inView = await page.evaluate(() => {
              const r = document.activeElement!.getBoundingClientRect();
              return (
                r.top >= 0 &&
                r.bottom <= window.innerHeight &&
                r.left >= 0 &&
                r.right <= window.innerWidth
              );
            });
            expect(inView, `${step.name} is on screen`).toBe(true);
          }
        }
      });
    }

    test("E9: no video in #projects and every fan image is lazy", async ({ page }) => {
      await open(page, "blue");
      await expect(page.locator("#projects video")).toHaveCount(0);
      const loading = await page
        .locator("#projects [data-fan-card] img")
        .evaluateAll((els) => els.map((el) => el.getAttribute("loading")));
      expect(loading).toHaveLength(15);
      for (const l of loading) expect(l).toBe("lazy");
    });

    test("E10: red and blue tint the shots with hue-rotate; green shows them as captured", async ({
      page,
    }) => {
      for (const mode of MODES) {
        await open(page, mode);
        const filter = await page
          .locator("#projects [data-fan-card] img")
          .first()
          .evaluate((el) => getComputedStyle(el).filter);
        if (mode === "both") expect(filter, mode).toBe("none");
        else expect(filter, mode).toContain("hue-rotate");
      }
    });
  });

  test.describe(`deck under reduced motion on ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });

    test("E8: a static list: no pin, flat cards in flow, and a static open fan", async ({
      page,
    }) => {
      for (const mode of ["blue", "red"] as const) {
        await open(page, mode, "calm");
        const pin = page.locator("#projects [data-deck-pin]");
        expect(await pin.evaluate((el) => getComputedStyle(el).position), mode).not.toBe("sticky");
        const cardsLoc = page.locator("#projects article[data-deck-card]");
        await expect(cardsLoc).toHaveCount(5);
        const state = await cardsLoc.evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              transform: getComputedStyle(el).transform,
              animations: el.getAnimations().length,
              top: r.top + window.scrollY,
              bottom: r.bottom + window.scrollY,
            };
          }),
        );
        state.forEach((c, i) => {
          expect(c.transform, `${mode} card ${i} transform`).toBe("none");
          expect(c.animations, `${mode} card ${i} animations`).toBe(0);
          if (i > 0) {
            expect(c.top, `${mode} card ${i} below card ${i - 1}`).toBeGreaterThanOrEqual(
              state[i - 1].bottom - 1,
            );
          }
        });
        for (let i = 0; i < N; i++) {
          await cardsLoc.nth(i).scrollIntoViewIfNeeded();
          const imgs = cardsLoc.nth(i).locator("[data-fan-card] img");
          await expect(imgs).toHaveCount(3);
          for (let k = 0; k < 3; k++)
            await expect(imgs.nth(k), `${mode} card ${i} shot ${k + 1}`).toBeVisible();
          const angles = (await fan(page, i)).angles;
          for (let a = 0; a < 3; a++) {
            for (let b = a + 1; b < 3; b++) {
              expect(
                Math.abs(angles[a] - angles[b]),
                `${mode} card ${i} static fan angles ${angles.join(", ")}`,
              ).toBeGreaterThan(1);
            }
          }
        }
      }
    });
  });
}
