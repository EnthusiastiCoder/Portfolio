import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { projects } from "../src/data/projects";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
}

// Case 48
test("home page has no WCAG 2.1 A/AA violations", async ({ page }) => {
  await page.goto("/");
  expect(await axeViolations(page)).toEqual([]);
});

// Case 49
test("first project page has no WCAG 2.1 A/AA violations", async ({ page }) => {
  await page.goto(`/projects/${projects[0].slug}`);
  expect(await axeViolations(page)).toEqual([]);
});

// Case 50
test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("home page has no violations with reduced motion", async ({ page }) => {
    await page.goto("/");
    expect(await axeViolations(page)).toEqual([]);
  });
});

// E2 (WS1): axe is clean in each pill mode, including a project detail page.
test.describe("pill modes", () => {
  for (const url of ["/?pill=red", "/?pill=blue", "/projects/nopload?pill=red"]) {
    test(`${url} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("load");
      const pill = new URL(url, "http://localhost").searchParams.get("pill")!;
      await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("home page has no violations on mobile with the menu opened", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("header button[aria-expanded]").first();
    if ((await toggle.count()) > 0 && (await toggle.isVisible())) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }
    expect(await axeViolations(page)).toEqual([]);
  });
});
