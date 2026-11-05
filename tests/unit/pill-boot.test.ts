// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { effectsBootScript } from "@/lib/effects";

// T2 (WS1): the inline boot scripts, evaluated in jsdom.

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
  vi.stubGlobal("matchMedia", impl);
  window.matchMedia = impl as unknown as typeof window.matchMedia;
}

function run(script: string): void {
  new Function(script)();
}

function setUrl(pathAndSearch: string): void {
  window.history.replaceState(null, "", pathAndSearch);
}

const html = () => document.documentElement;

function resetDom(): void {
  delete html().dataset.pill;
  delete html().dataset.pillChosen;
  delete html().dataset.effects;
  localStorage.clear();
  setUrl("/");
}

beforeEach(() => {
  resetDom();
  stubMatchMedia(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetDom();
});

describe("pillBootScript", () => {
  // Loaded lazily (through a variable, so Vite does not resolve it at transform time)
  // so the effects cases below still run while src/lib/pill.ts is missing.
  const PILL_MODULE = "@/lib/pill";
  async function bootScript(): Promise<string> {
    const mod = await import(/* @vite-ignore */ PILL_MODULE);
    expect(typeof mod.pillBootScript).toBe("string");
    return mod.pillBootScript;
  }

  it("applies ?pill=blue as a chosen pill without writing localStorage", async () => {
    const script = await bootScript();
    setUrl("/?pill=blue");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    run(script);
    expect(html().dataset.pill).toBe("blue");
    expect(html().getAttribute("data-pill-chosen")).toBe("true");
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem("matrix-pill")).toBeNull();
  });

  it("applies a stored red choice when there is no param", async () => {
    const script = await bootScript();
    localStorage.setItem("matrix-pill", "red");
    run(script);
    expect(html().dataset.pill).toBe("red");
    expect(html().getAttribute("data-pill-chosen")).toBe("true");
  });

  it("lets the param beat the stored choice", async () => {
    const script = await bootScript();
    localStorage.setItem("matrix-pill", "red");
    setUrl("/?pill=blue");
    run(script);
    expect(html().dataset.pill).toBe("blue");
  });

  it("defaults to both without data-pill-chosen", async () => {
    const script = await bootScript();
    run(script);
    expect(html().dataset.pill).toBe("both");
    expect(html().hasAttribute("data-pill-chosen")).toBe(false);
  });

  it("ignores an invalid stored value", async () => {
    const script = await bootScript();
    localStorage.setItem("matrix-pill", "green");
    run(script);
    expect(html().dataset.pill).toBe("both");
    expect(html().hasAttribute("data-pill-chosen")).toBe(false);
  });

  it("does not throw when localStorage throws", async () => {
    const script = await bootScript();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => run(script)).not.toThrow();
  });
});

describe("effectsBootScript", () => {
  it("does not touch localStorage", () => {
    expect(effectsBootScript).not.toContain("localStorage");
  });

  it("ignores a stored matrix-effects=calm and sets full when motion is allowed", () => {
    localStorage.setItem("matrix-effects", "calm");
    stubMatchMedia(false);
    run(effectsBootScript);
    expect(html().dataset.effects).toBe("full");
  });

  it("sets calm under reduced motion", () => {
    stubMatchMedia(true);
    run(effectsBootScript);
    expect(html().dataset.effects).toBe("calm");
  });
});
