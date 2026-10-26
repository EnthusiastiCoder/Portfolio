import { test, expect } from "@playwright/test";
import { siteConfig } from "../src/config/site";
import { projects } from "../src/data/projects";
import { projectLinks } from "../src/config/project-links";

const CTA_LABELS: Record<string, string> = {
  nopload: "Open Nopload",
  foreverqr: "Open ForeverQR",
  quietpdf: "Open QuietPDF",
  framelab: "Open Framelab",
  syncplay: "Get SyncPlay",
};

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

  // Case 41 (T24): no GitHub repo/stats blocks, and no LeetCode anywhere in any mode.
  test("shows no GitHub stats and no LeetCode in any mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="github-stats"]')).toHaveCount(0);
    const projectsText = await page.locator("#projects").innerText();
    expect(projectsText).not.toMatch(/Secret-Message-Extractor|RepoSnap|PDFtoDOC/);

    for (const pill of ["red", "blue", "both"]) {
      await page.goto(`/?pill=${pill}`);
      await expect(page.locator('[data-testid="leetcode-stats"]')).toHaveCount(0);
      await expect(page.locator('a[href*="leetcode.com"]')).toHaveCount(0);
      expect(await page.locator("main").textContent(), `${pill} mode`).not.toMatch(/leetcode/i);
    }
  });

  // T25: each product card has its primary CTA, preceded by media in DOM order.
  test("each project card has a visible primary CTA after its media", async ({ page }) => {
    await page.goto("/?pill=red");
    for (const [slug, label] of Object.entries(CTA_LABELS)) {
      const entry = projectLinks[slug];
      expect(entry?.state, `${slug} link state`).toBe("live");
      const url = entry?.state === "live" ? entry.url : "";
      const cta = page
        .locator("#projects a")
        .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
        .first();
      await cta.scrollIntoViewIfNeeded();
      await expect(cta, `${slug} CTA`).toBeVisible();
      await expect(cta, `${slug} CTA href`).toHaveAttribute("href", url);

      const mediaBefore = await cta.evaluate((a) => {
        const MEDIA = 'img, svg[role="img"][aria-label*="Illustration" i]';
        let node: Element | null = a.parentElement;
        while (node && !node.querySelector(MEDIA)) node = node.parentElement;
        if (!node) return false;
        return Array.from(node.querySelectorAll(MEDIA)).some(
          (m) => (a.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_PRECEDING) !== 0,
        );
      });
      expect(mediaBefore, `${slug} media precedes CTA`).toBe(true);
    }
  });

  // T25
  test("matrix-portfolio detail page is gone", async ({ page }) => {
    const response = await page.goto("/projects/matrix-portfolio");
    expect(response?.status()).toBe(404);
  });

  // Case 43
  test("links a downloadable resume PDF", async ({ page, request }) => {
    await page.goto("/");
    const resume = page.locator('a[href="/resume.pdf"]').first();
    await expect(resume).toBeAttached();
    await expect(resume).toHaveAccessibleName(/resume/i);
    await expect(resume).toHaveAttribute("download");

    const pdf = await request.get("/resume.pdf");
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  // Case 44
  test("has contact email and social links, and safe external links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(`a[href^="mailto:${siteConfig.email}"]`).first()).toBeAttached();
    await expect(
      page.locator('a[href="https://github.com/EnthusiastiCoder"]').first(),
    ).toBeAttached();

    const rels = await page
      .locator('a[target="_blank"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("rel") ?? ""));
    for (const rel of rels) {
      const tokens = rel.split(/\s+/);
      expect(tokens).toContain("noopener");
      expect(tokens).toContain("noreferrer");
    }
  });

  // Case 45
  test("has SEO and social meta tags", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator('meta[name="twitter:card"]').first()).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('link[rel="canonical"]').first()).toHaveAttribute("href", /.+/);
    await expect(page.locator('meta[name="description"]').first()).toHaveAttribute("content", /\S/);
  });
});

test.describe("project pages", () => {
  // Case 42
  // The overview card opens the detail view; its full write-up link reaches the page.
  test("first featured project card navigates to its detail page", async ({ page }) => {
    await page.goto("/");
    const open = page.locator("#projects [data-project-open]:visible").first();
    await open.scrollIntoViewIfNeeded();
    await open.click();
    const card = page.locator('dialog.pd[open] a[href^="/projects/"]').first();
    await card.scrollIntoViewIfNeeded();
    const href = await card.getAttribute("href");
    expect(href).toMatch(/^\/projects\/[a-z0-9-]+$/);
    const slug = href!.replace("/projects/", "");
    const project = projects.find((p) => p.slug === slug);
    expect(project, `project for slug ${slug}`).toBeDefined();
    expect(project!.featured).toBe(true);

    await card.click();
    await page.waitForURL(`**/projects/${slug}`);
    await expect(page.locator("h1")).toHaveText(project!.title);
  });

  test("unknown project slug returns 404", async ({ page }) => {
    const response = await page.goto("/projects/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("sitemap and robots", () => {
  // Case 46
  test("serves sitemap.xml and robots.txt", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/projects/");

    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  // Case 47
  test("hero h1 is fully visible immediately after load", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    const opacity = await h1.evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });
});
