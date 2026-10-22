// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import HeroGlitch from "@/components/matrix/HeroGlitch";
import { GLITCH_BURST_MS, GLITCH_GAP_MS, pickBetween } from "@/lib/effects";
import { writePill } from "@/lib/pill";

// The hero name glitch: still at rest, short random bursts, none under reduced motion.

function stubMatchMedia(reducedMotion: boolean): void {
  const impl = (query: string) => ({
    matches: reducedMotion && /prefers-reduced-motion:\s*reduce/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
  window.matchMedia = impl as unknown as typeof window.matchMedia;
}

const html = () => document.documentElement;
let target: HTMLDivElement;
let hidden = false;

function setHidden(value: boolean): void {
  hidden = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  target = document.createElement("div");
  target.id = "hero-name";
  document.body.append(target);
  html().dataset.effects = "full";
  html().dataset.pill = "both";
  stubMatchMedia(false);
});

afterEach(() => {
  cleanup();
  target.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete html().dataset.effects;
  delete html().dataset.pill;
});

describe("pickBetween", () => {
  it("maps 0 and 1 onto the range ends and clamps outside values", () => {
    expect(pickBetween(GLITCH_GAP_MS, 0)).toBe(4000);
    expect(pickBetween(GLITCH_GAP_MS, 1)).toBe(9000);
    expect(pickBetween(GLITCH_BURST_MS, 0.5)).toBe(250);
    expect(pickBetween(GLITCH_BURST_MS, -1)).toBe(150);
    expect(pickBetween(GLITCH_BURST_MS, 2)).toBe(350);
  });
});

describe("HeroGlitch", () => {
  it("is still at rest, bursts once on reveal, then every 4 to 9 s", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<HeroGlitch />);
    expect(target.hasAttribute("data-burst")).toBe(false);

    act(() => vi.advanceTimersByTime(700));
    expect(target.hasAttribute("data-burst")).toBe(true);
    expect(target.style.getPropertyValue("--glitch-ms")).toBe("150ms");

    act(() => vi.advanceTimersByTime(150));
    expect(target.hasAttribute("data-burst")).toBe(false);

    act(() => vi.advanceTimersByTime(4000 - 150 - 1));
    expect(target.hasAttribute("data-burst")).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(target.hasAttribute("data-burst")).toBe(true);
  });

  it("bursts when the pill mode changes", () => {
    render(<HeroGlitch />);
    act(() => writePill("red", { persist: false, updateUrl: false }));
    expect(target.hasAttribute("data-burst")).toBe(true);
  });

  it("never bursts under reduced motion or calm effects", () => {
    stubMatchMedia(true);
    html().dataset.effects = "calm";
    const seen: (string | null)[] = [];
    const observer = new MutationObserver(() => seen.push(target.getAttribute("data-burst")));
    observer.observe(target, { attributes: true, attributeFilter: ["data-burst"] });
    render(<HeroGlitch />);
    act(() => vi.advanceTimersByTime(60_000));
    act(() => writePill("blue", { persist: false, updateUrl: false }));
    act(() => vi.advanceTimersByTime(60_000));
    observer.disconnect();
    expect(target.hasAttribute("data-burst")).toBe(false);
    expect(seen).toEqual([]);
  });

  it("pauses while the tab is hidden and resumes when it is shown", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    render(<HeroGlitch />);
    act(() => setHidden(true));
    act(() => vi.advanceTimersByTime(60_000));
    expect(target.hasAttribute("data-burst")).toBe(false);
    act(() => setHidden(false));
    act(() => vi.advanceTimersByTime(4000));
    expect(target.hasAttribute("data-burst")).toBe(true);
  });

  it("clears its timers and the attribute on unmount", () => {
    const { unmount } = render(<HeroGlitch />);
    act(() => vi.advanceTimersByTime(700));
    unmount();
    expect(target.hasAttribute("data-burst")).toBe(false);
    act(() => vi.advanceTimersByTime(60_000));
    expect(target.hasAttribute("data-burst")).toBe(false);
  });
});

describe("globals.css hero name glitch", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("has no hover or focus trigger and no resting offset", () => {
    expect(css).not.toMatch(/\.glitch:hover/);
    expect(css).not.toMatch(/\.glitch:focus-within/);
  });

  it("drives the burst with stepped keyframes only", () => {
    for (const name of [
      "glitch-burst-r",
      "glitch-burst-b",
      "glitch-burst-base",
      "glitch-burst-skew",
    ]) {
      expect(css).toMatch(new RegExp(String.raw`@keyframes\s+${name}\s*\{`));
      expect(css).toMatch(new RegExp(String.raw`animation(-name)?:\s*${name}[\s;]`));
    }
    const uses = css.match(/animation:\s*glitch-burst-[^;]+;/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) expect(use).toContain("steps(1, end)");
  });
});
