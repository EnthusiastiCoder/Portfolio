import { test, expect } from "@playwright/test";
import { siteConfig } from "../src/config/site";
import { projects } from "../src/data/projects";
import githubSnapshot from "../src/data/snapshots/github.json";
import leetcodeSnapshot from "../src/data/snapshots/leetcode.json";

// Same rule as src/lib/format.ts formatCompactNumber.
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

test.describe("home page", () => {
  // Case 38
  test("returns 200 and has exactly one h1 containing the site name", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText(siteConfig.name);
  });

  // Case 39
  test("has the main sections and nav anchors", async ({ page }) => {
    await page.goto("/");
    for (const id of ["about", "projects", "experience", "contact"]) {
      const section = page.locator(`#${id}`);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
      await expect(page.locator(`a[href="#${id}"]`).first()).toBeAttached();
    }
  });

  // Case 40
  test("first Tab focuses the skip link to #main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAccessibleName(/skip to content/i);
    await expect(focused).toHaveAttribute("href", "#main");
    await expect(page.locator("main#main")).toHaveCount(1);
  });

  // Case 41
  test("renders snapshot stats", async ({ page }) => {
    await page.goto("/");
    const leetcode = page.getByTestId("leetcode-stats");
    await leetcode.scrollIntoViewIfNeeded();
    await expect(leetcode).toContainText(String(leetcodeSnapshot.data.solved.all));

    const github = page.getByTestId("github-stats");
    await github.scrollIntoViewIfNeeded();
    await expect(github).toContainText(compact(githubSnapshot.data.publicRepos));
    await expect(github).toContainText(compact(githubSnapshot.data.totalStars));
  });
