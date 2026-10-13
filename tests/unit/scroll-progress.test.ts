// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

// T13 (WS2): the shared scroll progress helper.
// Contract: subscribeScroll(cb) returns an unsubscribe function; cb receives { p, heroP }.

type ScrollState = { p: number; heroP: number };
type ScrollModule = { subscribeScroll: (cb: (s: ScrollState) => void) => () => void };

const SOURCE = path.resolve(process.cwd(), "src/lib/scroll-progress.ts");

let frames: FrameRequestCallback[] = [];

function runFrames(): void {
  const pending = frames;
  frames = [];
  for (const cb of pending) cb(performance.now());
}

function setScroll(y: number, innerHeight = 900): void {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  Object.defineProperty(window, "pageYOffset", { value: y, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: innerHeight, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

const heroP = () =>
  parseFloat(document.documentElement.style.getPropertyValue("--hero-p"));

/** Fresh module per test, so the single-listener state starts clean. */
async function load(): Promise<ScrollModule> {
  expect(existsSync(SOURCE), "src/lib/scroll-progress.ts exists").toBe(true);
  vi.resetModules();
  // import.meta.glob returns {} while the file is missing, so the file still loads and
  // each case fails on its own; once the file exists it is a normal (aliased) import.
  const mods = import.meta.glob("/src/lib/scroll-progress.ts");
  return (await mods["/src/lib/scroll-progress.ts"]()) as unknown as ScrollModule;
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  setScroll(0);
  document.documentElement.style.removeProperty("--hero-p");
  document.documentElement.style.removeProperty("--p");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scroll-progress", () => {
  it("writes --hero-p = scrollY / innerHeight after a scroll and one frame", async () => {
    const { subscribeScroll } = await load();
    const unsubscribe = subscribeScroll(() => {});
    setScroll(450, 900);
    runFrames();
    expect(heroP()).toBeCloseTo(0.5, 5);
    expect(document.documentElement.style.getPropertyValue("--p")).not.toBe("");
    unsubscribe();
  });

  it("clamps --hero-p to 0..1", async () => {
    const { subscribeScroll } = await load();
    const unsubscribe = subscribeScroll(() => {});
    setScroll(2700, 900);
    runFrames();
    expect(heroP()).toBe(1);
    setScroll(-50, 900);
    runFrames();
    expect(heroP()).toBe(0);
    unsubscribe();
  });

  it("passes the value to every subscriber and stops after unsubscribe", async () => {
    const { subscribeScroll } = await load();
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeScroll(a);
    const offB = subscribeScroll(b);
    setScroll(225, 900);
    runFrames();
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    expect(a.mock.calls.at(-1)![0].heroP).toBeCloseTo(0.25, 5);
    expect(b.mock.calls.at(-1)![0].heroP).toBeCloseTo(0.25, 5);

    offA();
    a.mockClear();
    b.mockClear();
    setScroll(450, 900);
    runFrames();
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    offB();
  });

  it("adds one passive scroll listener for many subscribers", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const { subscribeScroll } = await load();
    const offs = [subscribeScroll(() => {}), subscribeScroll(() => {}), subscribeScroll(() => {})];
    const scrollAdds = add.mock.calls.filter(([type]) => type === "scroll");
    expect(scrollAdds).toHaveLength(1);
    const opts = scrollAdds[0][2];
    expect(typeof opts === "object" && opts !== null && (opts as AddEventListenerOptions).passive).toBe(
      true,
    );
    for (const off of offs) off();
  });

  it("throttles to one animation frame per burst of scroll events", async () => {
    const { subscribeScroll } = await load();
    const off = subscribeScroll(() => {});
    const raf = window.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>;
    raf.mockClear();
    setScroll(100);
    setScroll(200);
    setScroll(300);
    expect(raf).toHaveBeenCalledTimes(1);
    runFrames();
    expect(heroP()).toBeCloseTo(300 / 900, 5);
    off();
  });
});
