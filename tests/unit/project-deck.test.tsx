// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// WS2 (plans/2026-11-23_projects-deck-redesign.md): the projects section is one
// "3D deck in a folder" in every mode. Each card keeps the overview copy and
// shows a fan of 3 usage shots; the detail dialog shows the themed use-3 shot.

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, className, loading, sizes } = props as {
      src: string | { src: string };
      alt: string;
      width?: number;
      height?: number;
      className?: string;
      loading?: string;
      sizes?: string;
    };
    return createElement("img", {
      src: typeof src === "string" ? src : src.src,
      alt,
      width,
      height,
      className,
      loading,
      sizes,
    });
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

class NoopIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  const mm = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  vi.stubGlobal("matchMedia", mm);
  window.matchMedia = mm as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ORDER = ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"];
const ROOT = process.cwd();

async function mountProjects(): Promise<HTMLElement> {
  const Projects = (await import("@/components/Projects")).default;
  return render(createElement(Projects)).container;
}

/** The value of a custom property in an inline style attribute, e.g. `--i: 2`. */
function customProp(el: Element, name: string): number | null {
  const style = el.getAttribute("style") ?? "";
  const m = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*(-?[\\d.]+)`));
  return m ? Number(m[1]) : null;
}

function deckCards(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-deck] article[data-deck-card]")];
}

async function project(slug: string) {
  const { getProjectBySlug } = await import("@/lib/projects");
  const p = getProjectBySlug(slug);
  if (!p) throw new Error(slug);
  return p;
}

describe("project deck (WS2)", () => {
  it("D1: one deck, shown in every mode, with 5 cards in showcase order and only the first current", async () => {
    const root = await mountProjects();
    const decks = root.querySelectorAll("[data-deck]");
    expect(decks).toHaveLength(1);
    const deck = decks[0] as HTMLElement;
    const section = deck.closest("section#projects");
    expect(section, "deck inside #projects").not.toBeNull();
    for (let el: Element | null = deck; el && el !== section; el = el.parentElement) {
      expect(el.hasAttribute("data-show"), `<${el.tagName.toLowerCase()}> has no data-show`).toBe(
        false,
      );
    }
    expect(section!.hasAttribute("data-show"), "section has no data-show").toBe(false);
    expect(deck.querySelector("[data-deck-pin]"), "deck pin").not.toBeNull();

    const cards = deckCards(root);
    expect(cards).toHaveLength(5);
    expect(cards.map((c) => c.getAttribute("aria-labelledby"))).toEqual(
      ORDER.map((s) => `pj-${s}`),
    );
    expect(cards.map((c) => customProp(c, "--i"))).toEqual([0, 1, 2, 3, 4]);
    expect(cards.map((c) => c.hasAttribute("data-current"))).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("D2: each card keeps the overview copy: counter, name, use case, 3 chips, one number per mode, both actions", async () => {
    const root = await mountProjects();
    const cards = deckCards(root);
    expect(cards).toHaveLength(5);
    for (const [i, slug] of ORDER.entries()) {
      const p = await project(slug);
      const card = cards[i];
      expect(card.querySelector(".ov-count")?.textContent?.trim(), `${slug} counter`).toBe(
        `0${i + 1} / 05`,
      );
      const h3 = card.querySelector(`h3#pj-${slug}`);
      expect(h3, `${slug} h3#pj-${slug}`).not.toBeNull();
      expect(
        h3!.querySelector(`button.pj-open[data-project-open="${slug}"]`),
        `${slug} open button`,
      ).not.toBeNull();
      expect(card.querySelector(".ov-use")?.textContent, `${slug} use case`).toBe(p.useCase);
      expect(card.querySelectorAll(".ov-features li"), `${slug} chips`).toHaveLength(3);
      expect(
        card.querySelector('[data-show="red"] dl.ov-figure'),
        `${slug} red measured figure`,
      ).not.toBeNull();
      expect(
        card.querySelector('[data-show="blue both"] p.ov-figure'),
        `${slug} blue and green user figure`,
      ).not.toBeNull();
      const cta = [...card.querySelectorAll("a")].find(
        (a) => a.textContent?.trim() === p.primaryCta.label,
      );
      expect(cta, `${slug} CTA "${p.primaryCta.label}"`).toBeDefined();
      expect(cta!.getAttribute("href"), `${slug} CTA href`).toBe(p.primaryCta.href);
      const how = [...card.querySelectorAll("button")].find((b) =>
        /how it's built/i.test(b.textContent ?? ""),
      );
      expect(how, `${slug} How it's built`).toBeDefined();
      expect(how!.getAttribute("data-project-open"), `${slug} How it's built opens`).toBe(slug);
    }
  });

  it("D3: each card has a fan of 3 usage shots (--k -1, 0, 1) with lazy images and captions", async () => {
    const root = await mountProjects();
    const cards = deckCards(root);
    expect(cards).toHaveLength(5);
    for (const [i, slug] of ORDER.entries()) {
      const fans = cards[i].querySelectorAll("[data-fan]");
      expect(fans, `${slug} fans`).toHaveLength(1);
      const figs = [...fans[0].querySelectorAll("figure[data-fan-card]")];
      expect(figs, `${slug} fan cards`).toHaveLength(3);
      expect(figs.map((f) => customProp(f, "--k")), `${slug} --k`).toEqual([-1, 0, 1]);
      figs.forEach((fig, n) => {
        const imgs = fig.querySelectorAll("img");
        expect(imgs, `${slug} fan card ${n + 1} images`).toHaveLength(1);
        const img = imgs[0];
        expect(img.getAttribute("src"), `${slug} fan card ${n + 1} src`).toContain(
          `/projects/${slug}/use-${n + 1}.webp`,
        );
        expect((img.getAttribute("alt") ?? "").trim(), `${slug} alt ${n + 1}`).not.toBe("");
        expect(img.getAttribute("width"), `${slug} width ${n + 1}`).toBeTruthy();
        expect(img.getAttribute("height"), `${slug} height ${n + 1}`).toBeTruthy();
        expect(img.getAttribute("loading"), `${slug} loading ${n + 1}`).toBe("lazy");
        const caption = fig.querySelector("figcaption");
        expect(caption, `${slug} caption ${n + 1}`).not.toBeNull();
        expect(caption!.textContent?.trim(), `${slug} caption ${n + 1}`).not.toBe("");
      });
    }
  });

  it("D4: no demo video remains in the section", async () => {
    const root = await mountProjects();
    expect(root.querySelector("[data-deck]"), "the deck renders").not.toBeNull();
    expect(root.querySelectorAll("video")).toHaveLength(0);
    expect(root.querySelectorAll("[data-demo-video]")).toHaveLength(0);
    expect(root.querySelectorAll("figure.demo")).toHaveLength(0);
  });

  it("D5: each detail dialog shows the themed use-3 shot", async () => {
    const root = await mountProjects();
    for (const slug of ORDER) {
      const dialog = root.querySelector(`dialog[data-project-detail="${slug}"]`);
      expect(dialog, `${slug} dialog`).not.toBeNull();
      const srcs = [...dialog!.querySelectorAll("img")].map((img) => img.getAttribute("src") ?? "");
      expect(
        srcs.some((s) => s.includes(`/projects/${slug}/use-3.webp`)),
        `${slug} dialog images: ${srcs.join(", ")}`,
      ).toBe(true);
    }
  });

  it("D6: the demo components and demo media are deleted", () => {
    const gone = [
      ...["DemoVideo", "DemoPlayer", "ProjectScreens", "ProductStage", "StageController"].map(
        (c) => `src/components/projects/${c}.tsx`,
      ),
      ...ORDER.flatMap((s) => [`public/projects/${s}/demo.webm`, `public/projects/${s}/demo-poster.png`]),
    ];
    const present = gone.filter((f) => existsSync(path.join(ROOT, f)));
    expect(present).toEqual([]);
  });

  it("D7: package.json dependencies are unchanged", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      "@mdx-js/loader",
      "@mdx-js/react",
      "@next/mdx",
      "@types/mdx",
      "motion",
      "next",
      "react",
      "react-dom",
      "three",
      "zod",
    ]);
  });
});
