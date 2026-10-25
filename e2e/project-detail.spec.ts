import { test, expect, type Page } from "@playwright/test";

// The full-screen project detail view: opens from an overview card, traps
// focus, closes with Back, Esc and the browser Back, and gives focus back.

async function open(page: Page, pill: "red" | "blue" | "both"): Promise<void> {
  await page.goto(`/?pill=${pill}`);
  await expect(page.locator("html")).toHaveAttribute("data-pill", pill);
}

async function openFirst(page: Page) {
  const button = page.locator("#projects [data-project-open]:visible").first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  const dialog = page.locator("dialog.pd[open]");
  await expect(dialog).toBeVisible();
  return { button, dialog };
}

test.describe("project detail view", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const pill of ["red", "blue", "both"] as const) {
    test(`${pill}: a click opens a modal detail with the URL updated`, async ({ page }) => {
      await open(page, pill);
      const { dialog } = await openFirst(page);
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(new URL(page.url()).searchParams.get("project")).toBeTruthy();
      await expect(dialog.getByRole("button", { name: /back to projects/i })).toBeFocused();
    });
  }

  test("Esc closes it and focus returns to the card", async ({ page }) => {
    await open(page, "red");
    const { button } = await openFirst(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.pd[open]")).toHaveCount(0);
    await expect(button).toBeFocused();
    expect(new URL(page.url()).searchParams.get("project")).toBeNull();
  });

  test("the Back button and the browser Back both close it", async ({ page }) => {
    await open(page, "blue");
    const { dialog, button } = await openFirst(page);
    await dialog.getByRole("button", { name: /back to projects/i }).click();
    await expect(page.locator("dialog.pd[open]")).toHaveCount(0);
    await expect(button).toBeFocused();

    await openFirst(page);
    await page.goBack();
    await expect(page.locator("dialog.pd[open]")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-pill", "blue");
  });

  test("Enter on the focused card opens it, and Tab stays inside", async ({ page }) => {
    await open(page, "both");
    const button = page.locator("#projects [data-project-open]:visible").first();
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator("dialog.pd[open]");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
  });

  test("a ?project= link opens that product's detail on load", async ({ page }) => {
    await page.goto("/?pill=red&project=quietpdf");
    await expect(page.locator('dialog[data-project-detail="quietpdf"][open]')).toBeVisible();
  });
});

test.describe("on a 390 px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the detail shows the architecture as readable text, not a shrunken drawing", async ({
    page,
  }) => {
    await open(page, "red");
    const { dialog } = await openFirst(page);
    await expect(dialog.locator(".pd-flow")).toBeVisible();
    await expect(dialog.locator("svg[data-diagram]")).toBeHidden();
    const size = await dialog
      .locator(".arch-flow-node")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(14);
  });

  test("the floating sound and rain toggles never sit over the hero card text", async ({
    page,
  }) => {
    await open(page, "red");
    const toggle = page.locator(".sound-toggle").first();
    await expect(toggle).toBeVisible();
    const copy = page.locator(".hero-copy");
    for (const y of [0, 200, 400, 600]) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      const overlap = await page.evaluate(() => {
        const t = document.querySelector(".sound-toggle")!.getBoundingClientRect();
        const strip =
          window.innerHeight - parseFloat(getComputedStyle(document.body, "::after").height);
        const texts = [...document.querySelectorAll(".hero-copy p, .hero-copy div")];
        return texts.some((el) => {
          const r = el.getBoundingClientRect();
          const visibleBottom = Math.min(r.bottom, strip);
          return r.top < t.bottom && visibleBottom > t.top && r.left < t.right && r.right > t.left;
        });
      });
      expect(overlap, `overlap at scroll ${y}`).toBe(false);
    }
    await expect(copy).toBeVisible();
  });
});
