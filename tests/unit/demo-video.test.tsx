// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { createElement } from "react";

// The overview's demo: a lazy, muted, looping video in a browser frame that
// plays only while in view, never under reduced motion, and falls back to the
// product's screenshot until public/projects/<slug>/demo.webm is recorded.

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) =>
    createElement("img", { src: props.src, alt: props.alt, className: props.className }),
}));

const files = new Set<string>();
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const existsSync = (p: string) => files.has(String(p).replace(/\\/g, "/").split("/public/")[1]);
  return { ...real, existsSync, default: { ...real, existsSync } };
});

type Observed = { cb: IntersectionObserverCallback; el: Element };
let observed: Observed[] = [];
let reducedMotion = false;
let play: ReturnType<typeof vi.spyOn>;
let pause: ReturnType<typeof vi.spyOn>;

class FakeIntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    observed.push({ cb: this.cb, el });
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function setInView(isIntersecting: boolean) {
  for (const { cb, el } of observed) {
    cb([{ isIntersecting, target: el } as IntersectionObserverEntry], {} as IntersectionObserver);
  }
}

beforeEach(() => {
  observed = [];
  reducedMotion = false;
  files.clear();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce") ? reducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  document.documentElement.dataset.effects = "full";
  // jsdom has no media playback.
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function project(slug: string) {
  const { getProjectBySlug } = await import("@/lib/projects");
  const p = getProjectBySlug(slug);
  if (!p) throw new Error(slug);
  return p;
}

async function mountDemo(slug: string) {
  const { default: DemoVideo } = await import("@/components/projects/DemoVideo");
  return render(createElement(DemoVideo, { project: await project(slug), sizes: "100vw" }))
    .container;
}

describe("DemoVideo", () => {
  it("shows the screenshot in the frame until a demo is recorded", async () => {
    const root = await mountDemo("nopload");
    expect(root.querySelector("figure.demo")?.getAttribute("data-demo")).toBe("still");
    expect(root.querySelector(".demo-screen img")?.getAttribute("src")).toBe(
      "/projects/nopload/home-dark-desktop.png",
    );
    expect(root.querySelector("video")).toBeNull();
    expect(root.querySelector(".demo-url")?.textContent).toBe("nopload-92m.pages.dev");
  });

  it("plays demo.webm with its poster once both files exist", async () => {
    files.add("projects/quietpdf/demo.webm");
    files.add("projects/quietpdf/demo-poster.png");
    const root = await mountDemo("quietpdf");
    const video = root.querySelector("video");
    expect(video).not.toBeNull();
    expect(root.querySelector("figure.demo")?.getAttribute("data-demo")).toBe("video");
    expect(video!.getAttribute("preload")).toBe("none");
    expect(video!.getAttribute("poster")).toBe("/projects/quietpdf/demo-poster.png");
    expect(video!.loop).toBe(true);
    expect(video!.muted).toBe(true);
    expect(video!.hasAttribute("playsinline")).toBe(true);
    expect(video!.querySelector("source")?.getAttribute("src")).toBe(
      "/projects/quietpdf/demo.webm",
    );
  });

  it("needs the poster too: a video without one falls back to the still", async () => {
    files.add("projects/quietpdf/demo.webm");
    const root = await mountDemo("quietpdf");
    expect(root.querySelector("video")).toBeNull();
  });

  it("names the desktop app instead of a GitHub address", async () => {
    const root = await mountDemo("syncplay");
    expect(root.querySelector(".demo-url")?.textContent).toBe("SyncPlay desktop app");
  });
});

describe("DemoPlayer", () => {
  async function mountPlayer() {
    const { default: DemoPlayer } = await import("@/components/projects/DemoPlayer");
    const root = render(
      createElement(DemoPlayer, { src: "/d.webm", poster: "/p.png", label: "Demo" }),
    ).container;
    return { root };
  }

  it("plays only while in view and pauses when it leaves", async () => {
    await mountPlayer();
    expect(play).not.toHaveBeenCalled();
    act(() => setInView(true));
    expect(play).toHaveBeenCalledTimes(1);
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {
      configurable: true,
      get: () => false,
    });
    act(() => setInView(false));
    expect(pause).toHaveBeenCalled();
    delete (HTMLMediaElement.prototype as { paused?: boolean }).paused;
  });

  it("never plays under reduced motion: the poster is all that shows", async () => {
    reducedMotion = true;
    await mountPlayer();
    act(() => setInView(true));
    expect(play).not.toHaveBeenCalled();
  });

  it("never plays with calm effects", async () => {
    document.documentElement.dataset.effects = "calm";
    await mountPlayer();
    act(() => setInView(true));
    expect(play).not.toHaveBeenCalled();
  });
});
