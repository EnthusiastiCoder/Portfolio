// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import PillChoice from "@/components/matrix/PillChoice";
import ModeOnly from "@/components/ModeOnly";
import { GLITCH_MS, writePill } from "@/lib/pill";

// T3 (WS1): the pill client islands, the glitch timing and ModeOnly.

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

const html = () => document.documentElement;

/** Reduced motion: matchMedia matches reduce and the effects level is calm. */
function reducedMotion(): void {
  stubMatchMedia(true);
  html().dataset.effects = "calm";
}

/** Motion allowed: matchMedia does not match reduce and the effects level is full. */
function fullMotion(): void {
  stubMatchMedia(false);
  html().dataset.effects = "full";
}

function resetDom(): void {
  for (const key of ["pill", "pillChosen", "effects", "glitch"]) delete html().dataset[key];
  localStorage.clear();
  window.history.replaceState(null, "", "/");
}

beforeEach(() => {
  resetDom();
  vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  // The boot script normally sets this before paint.
  html().dataset.pill = "both";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetDom();
});

describe("PillChoice", () => {
  it("renders exactly two type=button pills named red pill and blue pill", () => {
    reducedMotion();
    const { container } = render(<PillChoice />);
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.getAttribute("type")).toBe("button");
    expect(screen.getAllByRole("button", { name: /red pill/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /blue pill/i })).toHaveLength(1);
  });

  it("red under reduced motion applies, persists, updates the URL, presses and announces", () => {
    reducedMotion();
    const { container } = render(<PillChoice />);
    const red = screen.getByRole("button", { name: /red pill/i });
    const blue = screen.getByRole("button", { name: /blue pill/i });

    fireEvent.click(red);

    expect(html().dataset.pill).toBe("red");
    expect(html().getAttribute("data-pill-chosen")).toBe("true");
    expect(localStorage.getItem("matrix-pill")).toBe("red");
    expect(window.location.search).toContain("pill=red");
    expect(red.getAttribute("aria-pressed")).toBe("true");
    expect(blue.getAttribute("aria-pressed")).toBe("false");

    const regions = [...container.querySelectorAll('[aria-live="polite"]')];
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(regions.some((r) => (r.textContent ?? "").trim() !== "")).toBe(true);
  });

  it("with full effects, glitches on click, switches by GLITCH_MS and clears the glitch after GLITCH_MS", () => {
    fullMotion();
    vi.useFakeTimers();
    render(<PillChoice />);
    const blue = screen.getByRole("button", { name: /blue pill/i });

    fireEvent.click(blue);
    expect(html().getAttribute("data-glitch")).toBe("on");

    act(() => {
      vi.advanceTimersByTime(GLITCH_MS - 1);
    });
    expect(html().dataset.pill).toBe("blue");
    expect(html().getAttribute("data-glitch")).toBe("on");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(html().hasAttribute("data-glitch")).toBe(false);
    expect(html().dataset.pill).toBe("blue");
  });

  it("never sets data-glitch under reduced motion", () => {
    reducedMotion();
    vi.useFakeTimers();
    render(<PillChoice />);
    const seen: (string | null)[] = [];
    const observer = new MutationObserver(() => seen.push(html().getAttribute("data-glitch")));
    observer.observe(html(), { attributes: true, attributeFilter: ["data-glitch"] });

    fireEvent.click(screen.getByRole("button", { name: /blue pill/i }));
    expect(html().hasAttribute("data-glitch")).toBe(false);
    expect(html().dataset.pill).toBe("blue");
    act(() => {
      vi.advanceTimersByTime(GLITCH_MS * 2);
    });
    expect(html().hasAttribute("data-glitch")).toBe(false);
    // Records not yet delivered to the callback are still pending; count them too.
    const pending = observer.takeRecords();
    observer.disconnect();
    expect(seen).toEqual([]);
    expect(pending).toHaveLength(0);
  });
});

describe("PillChoice in-hand pills", () => {
  it("describes each pill with the figure's first-person message", () => {
    reducedMotion();
    render(<PillChoice />);
    const description = (name: string) => {
      const id = screen.getByRole("button", { name }).getAttribute("aria-describedby");
      return id ? document.getElementById(id)?.textContent : null;
    };
    expect(description("Red pill: go deep into the engineering")).toBe(
      "Take the red pill and I'll show you how deep the engineering goes: the architecture, the trade-offs and the numbers behind each build.",
    );
    expect(description("Blue pill: stay on the surface")).toBe(
      "Take the blue pill and I'll keep it on the surface: the products, the design and the people they help.",
    );
  });

  it("a touch tap picks the pill and shows its bubble briefly", () => {
    reducedMotion();
    vi.useFakeTimers();
    const { container } = render(<PillChoice />);
    const group = container.querySelector(".pill-hits")!;
    const red = screen.getByRole("button", { name: /red pill/i });
    fireEvent.pointerUp(red, { pointerType: "touch" });
    fireEvent.click(red);
    expect(html().dataset.pill).toBe("red");
    expect(group.getAttribute("data-say")).toBe("red");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(group.hasAttribute("data-say")).toBe(false);
  });

  it("a mouse click picks the pill without pinning the bubble", () => {
    reducedMotion();
    const { container } = render(<PillChoice />);
    const blue = screen.getByRole("button", { name: /blue pill/i });
    fireEvent.pointerUp(blue, { pointerType: "mouse" });
    fireEvent.click(blue);
    expect(html().dataset.pill).toBe("blue");
    expect(container.querySelector(".pill-hits")!.hasAttribute("data-say")).toBe(false);
  });
});

describe("writePill without persistence", () => {
  it("leaves localStorage and the URL untouched and does not mark a choice", () => {
    window.history.replaceState(null, "", "/?a=1#about");
    delete html().dataset.pill;
    writePill("both", { persist: false, updateUrl: false });
    expect(html().dataset.pill).toBe("both");
    expect(html().hasAttribute("data-pill-chosen")).toBe(false);
    expect(localStorage.getItem("matrix-pill")).toBeNull();
    expect(window.location.search).toBe("?a=1");
    expect(window.location.hash).toBe("#about");
  });
});

describe("ModeOnly", () => {
  it("renders data-show as the space-separated mode list", () => {
    const { container } = render(<ModeOnly modes={["red", "both"]}>depth</ModeOnly>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("data-show")).toBe("red both");
    expect(el.textContent).toBe("depth");
  });

  it('renders an li with as="li"', () => {
    const { container } = render(
      <ul>
        <ModeOnly modes={["blue"]} as="li">
          surface
        </ModeOnly>
      </ul>,
    );
    const li = container.querySelector("ul > li");
    expect(li).not.toBeNull();
    expect(li!.getAttribute("data-show")).toBe("blue");
  });
});
