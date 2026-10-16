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
