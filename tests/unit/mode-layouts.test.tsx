// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ComponentType, type ReactElement } from "react";
import { cleanup, render } from "@testing-library/react";

// T27: each section renders genuinely different red (engineer) and blue (visitor) layouts.

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, className } = props as {
      src: string | { src: string };
      alt: string;
      width?: number;
      height?: number;
      className?: string;
    };
    return createElement("img", {
      src: typeof src === "string" ? src : src.src,
      alt,
      width,
      height,
      className,
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

const RED = '[data-show~="red"]:not([data-show~="blue"])';
const BLUE = '[data-show~="blue"]:not([data-show~="red"])';

/** Renders a server or client component; async server components are awaited first. */
async function mount(Comp: unknown, props: Record<string, unknown> = {}): Promise<HTMLElement> {
  const fn = Comp as ComponentType<Record<string, unknown>> & ((p: unknown) => unknown);
  let element: ReactElement;
  if (fn.constructor?.name === "AsyncFunction") {
    element = (await fn(props)) as ReactElement;
  } else {
    element = createElement(fn as ComponentType<Record<string, unknown>>, props);
  }
  return render(element).container;
}

function tagSet(root: HTMLElement, selector: string): Set<string> {
  const tags = new Set<string>();
  for (const el of root.querySelectorAll(selector)) {
    tags.add(el.tagName.toLowerCase());
    for (const d of el.querySelectorAll("*")) tags.add(d.tagName.toLowerCase());
  }
  return tags;
}

function wordSet(root: HTMLElement, selector: string): Set<string> {
  const words = new Set<string>();
  for (const el of root.querySelectorAll(selector)) {
    for (const w of (el.textContent ?? "").toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) words.add(w);
  }
  return words;
}

const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));
const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && isSubset(a, b);

const SECTIONS: [string, () => Promise<unknown>, Record<string, unknown>][] = [
  ["About", async () => (await import("@/components/About")).default, {}],
  ["ExperienceTimeline", async () => (await import("@/components/ExperienceTimeline")).default, {}],
  ["Skills", async () => (await import("@/components/Skills")).default, {}],
  // repos: [] only keeps the current v1 Projects rendering; v2 takes no props.
  ["Projects", async () => (await import("@/components/Projects")).default, { repos: [] }],
];

describe("mode layouts (T27)", () => {
  it.each(SECTIONS)("%s renders distinct red and blue layouts", async (_name, load, props) => {
    const root = await mount(await load(), props);

    const redTags = tagSet(root, RED);
    const blueTags = tagSet(root, BLUE);
    expect(root.querySelectorAll(RED).length, "red-only subtree").toBeGreaterThan(0);
    expect(root.querySelectorAll(BLUE).length, "blue-only subtree").toBeGreaterThan(0);
    expect(sameSet(redTags, blueTags), "red and blue use different element structures").toBe(false);
    expect(
      ["table", "dl", "svg", "pre"].some((t) => redTags.has(t)),
      `red has table|dl|svg|pre, got ${[...redTags].join(",")}`,
    ).toBe(true);

    const redWords = wordSet(root, RED);
    const blueWords = wordSet(root, BLUE);
    expect(redWords.size, "red text").toBeGreaterThan(0);
    expect(blueWords.size, "blue text").toBeGreaterThan(0);
    expect(isSubset(redWords, blueWords), "red text is not a subset of blue").toBe(false);
    expect(isSubset(blueWords, redWords), "blue text is not a subset of red").toBe(false);
  });

  it("Projects shows 5 overview screens in red, a diagram per detail view and 4+ images in blue", async () => {
    const Projects = (await import("@/components/Projects")).default;
    const root = await mount(Projects, { repos: [] });
    const redScreens = [...root.querySelectorAll(RED)].flatMap((el) => [
      ...el.querySelectorAll("article"),
    ]);
    expect(new Set(redScreens).size).toBe(5);
    // The architecture moved into the full-screen detail views, one per product, in every mode.
    const details = [...root.querySelectorAll("dialog[data-project-detail]")];
    expect(details).toHaveLength(5);
    for (const d of details) expect(d.querySelector("svg[data-diagram]")).not.toBeNull();
    const blueImgs = [...root.querySelectorAll(BLUE)].flatMap((el) => [
      ...el.querySelectorAll("img, video[poster]"),
    ]);
    expect(new Set(blueImgs).size).toBeGreaterThanOrEqual(4);
  });
});
