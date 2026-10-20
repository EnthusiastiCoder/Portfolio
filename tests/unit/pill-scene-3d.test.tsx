// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { act, cleanup, render } from "@testing-library/react";

// WS2 three-scene-and-budget: T11-T12.
// Real three is used for scene objects; only the WebGL renderer is replaced (jsdom has no WebGL),
// and Image is stubbed so the portrait textures "load".

const rendererInstances = vi.hoisted(() => [] as any[]);

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    params: any;
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setClearColor = vi.fn();
    setAnimationLoop = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    getPixelRatio = vi.fn(() => 1);
    shadowMap = { enabled: false, type: 0 };
    outputColorSpace = "";
    toneMapping = 0;
    constructor(params: any = {}) {
      this.params = params;
      this.domElement = params.canvas ?? document.createElement("canvas");
      rendererInstances.push(this);
    }
  }
  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

const SOURCE = path.resolve(process.cwd(), "src/components/matrix/PillScene3D.tsx");

async function loadScene(): Promise<ComponentType> {
  expect(existsSync(SOURCE), "src/components/matrix/PillScene3D.tsx exists").toBe(true);
  // import.meta.glob returns {} while the file is missing, so the file still loads and
  // each case fails on its own; once the file exists it is a normal (aliased) import.
  const mods = import.meta.glob("/src/components/matrix/PillScene3D.tsx");
  const mod = (await mods["/src/components/matrix/PillScene3D.tsx"]()) as { default: unknown };
  return mod.default as ComponentType;
}

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

/** Reports every observed element as intersecting on the next microtask. */
class VisibleIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [];
  constructor(private cb: IntersectionObserverCallback) {}
  observe(target: Element) {
    queueMicrotask(() =>
      this.cb(
        [{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

/** jsdom never loads images: this one "loads" on the next microtask after src is set. */
class InstantImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = "auto";
  width = 4;
  height = 4;
  private _src = "";
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let rafSpy: ReturnType<typeof vi.fn>;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

beforeEach(() => {
  rendererInstances.length = 0;
  vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver);
  vi.stubGlobal("ResizeObserver", NoopResizeObserver);
  vi.stubGlobal("Image", InstantImage);
  rafSpy = vi.fn(() => 1);
  vi.stubGlobal("requestAnimationFrame", rafSpy);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  document.documentElement.dataset.pill = "both";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.pill;
  delete document.documentElement.dataset.effects;
});

describe("PillScene3D (T11)", () => {
  it("renders an aria-hidden container holding a canvas", async () => {
    stubMatchMedia(false);
    const Scene = await loadScene();
    const { container } = render(createElement(Scene));
    await flush();
    const canvas = container.querySelector("canvas");
    expect(canvas, "canvas").not.toBeNull();
    expect(canvas!.closest('[aria-hidden="true"]'), "aria-hidden ancestor").not.toBeNull();
  });

  it("caps the pixel ratio at 1.5 when devicePixelRatio is 3", async () => {
    stubMatchMedia(false);
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
    const Scene = await loadScene();
    render(createElement(Scene));
    await flush();
    expect(rendererInstances).toHaveLength(1);
    const r = rendererInstances[0];
    expect(r.setPixelRatio).toHaveBeenCalled();
    for (const [value] of r.setPixelRatio.mock.calls) {
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(1.5);
    }
    expect(r.params.powerPreference).toBe("low-power");
    expect(Boolean(r.params.antialias)).toBe(false);
  });

  it("under prefers-reduced-motion renders one still frame and never requests animation frames", async () => {
    stubMatchMedia(true);
    const Scene = await loadScene();
    const { container } = render(createElement(Scene));
    await flush();
    expect(rendererInstances).toHaveLength(1);
    const r = rendererInstances[0];
    expect(r.render).toHaveBeenCalledTimes(1);
    expect(rafSpy).not.toHaveBeenCalled();
    const loopCalls = r.setAnimationLoop.mock.calls.filter(([fn]: [unknown]) => typeof fn === "function");
    expect(loopCalls).toHaveLength(0);
    expect(container.querySelector('[data-scene-ready="true"]')).not.toBeNull();
  });

  it("disposes the renderer on unmount", async () => {
    stubMatchMedia(false);
    const Scene = await loadScene();
    const { unmount } = render(createElement(Scene));
    await flush();
    expect(rendererInstances).toHaveLength(1);
    unmount();
    expect(rendererInstances[0].dispose).toHaveBeenCalled();
  });
});

describe("PillScene3D source (T12)", () => {
  it("uses named three imports only and loads no models or textures", () => {
    expect(existsSync(SOURCE), "src/components/matrix/PillScene3D.tsx exists").toBe(true);
    const src = readFileSync(SOURCE, "utf8");
    expect(src).toMatch(/from\s+["']three["']/);
    expect(src).not.toMatch(/import\s+\*\s+as\s+\w+\s+from\s+["']three["']/);
    expect(src).not.toMatch(/\.glb\b/i);
    expect(src).not.toMatch(/\.gltf\b/i);
    expect(src).not.toContain("TextureLoader");
    expect(src).not.toContain("GLTFLoader");
  });
});
