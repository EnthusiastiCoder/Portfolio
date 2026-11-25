import { test, expect, type Page } from "@playwright/test";
import { frames, settle } from "./helpers/settle";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { PILL_STORAGE_KEY, type Pill } from "../src/lib/pill";

// T10 (WS1): visual acceptance screenshots for the verifier to open and review.
// Run: SHOT_LABEL=ws2 npx playwright test e2e/visual.spec.ts --workers=1
//
// Selector contract (shared with e2e/choreography.spec.ts):
//   [data-scene-ready="true"]  3D scene container after its first frame (WS2)
//   [data-deck]                the tall scroll wrapper of the pinned project deck (projects-deck WS2)

const LABEL = process.env.SHOT_LABEL ?? "latest";
const OUT_DIR = path.resolve(process.cwd(), "plans/reports/2026-11-23_portfolio-v2", LABEL);
const MIN_BYTES = 10 * 1024;

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

const MODES: Pill[] = ["red", "blue", "both"];

test.use({ headless: true });
test.describe.configure({ mode: "serial" });

function outFile(name: string): string {
  mkdirSync(OUT_DIR, { recursive: true });
  return path.join(OUT_DIR, name);
}

function expectPng(file: string): void {
  const size = statSync(file).size;
  expect(size, `${path.basename(file)} size`).toBeGreaterThan(MIN_BYTES);
}

/** Stores the mode under the same key the pill code uses, before any page script runs. */
async function openInMode(page: Page, mode: Pill): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage can be unavailable; the ?pill= param below still applies the mode.
      }
    },
    [PILL_STORAGE_KEY, mode] as const,
  );
  await page.goto(`/?pill=${mode}`);
  await page.waitForLoadState("load");
  await expect(page.locator("html")).toHaveAttribute("data-pill", mode);
  await expect(page.locator("html")).not.toHaveAttribute("data-glitch", /.*/);
}

/** Before WS2 there is no 3D scene; wait for it when it exists. */
async function waitForScene(page: Page): Promise<void> {
  await page
    .locator('#top [data-scene-ready="true"]')
    .first()
    .waitFor({ state: "attached", timeout: 15_000 })
    .catch(() => undefined);
}

/** Scrolls the whole page once so scroll-driven and lazy content has rendered, then back to top. */
async function warmUp(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  // Lazy content the scroll asked for has landed, and the top has painted.
  await page.waitForLoadState("networkidle");
  await frames(page);
}

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`${vpName} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    for (const mode of MODES) {
      test(`full page in ${mode}`, async ({ page }) => {
        await openInMode(page, mode);
        await waitForScene(page);
        await warmUp(page);
        const file = outFile(`${vpName}-${mode}-full.png`);
        await page.screenshot({ path: file, fullPage: true });
        expectPng(file);
      });
    }

    test("3D scene viewport", async ({ page }) => {
      await openInMode(page, "both");
      await waitForScene(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await frames(page);
      await settle(page, "#top .scene-frame, #top .hero-title");
      const file = outFile(`${vpName}-scene.png`);
      await page.screenshot({ path: file });
      expectPng(file);
    });

    test("pinned project deck at mid-scroll", async ({ page }) => {
      await openInMode(page, "blue");
      await warmUp(page);
      await page.evaluate(() => {
        const deck = document.querySelector<HTMLElement>("[data-deck]");
        const target = deck ?? document.getElementById("projects");
        if (!target) return;
        const top = target.getBoundingClientRect().top + window.scrollY;
        const travel = Math.max(0, target.offsetHeight - window.innerHeight);
        // Halfway through the deck, nudged so one card is peeling while the next rises.
        window.scrollTo(0, top + travel * 0.5 + window.innerHeight * 0.1);
      });
      await frames(page);
      await settle(page, "#projects article[data-deck-card], #projects figure[data-fan-card]");
      const file = outFile(`${vpName}-stage-mid.png`);
      await page.screenshot({ path: file });
      expectPng(file);
    });
  });
}
