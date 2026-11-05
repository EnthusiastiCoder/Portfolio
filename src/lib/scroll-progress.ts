/**
 * Shared scroll progress. One passive scroll listener (and one resize listener)
 * for the whole page, throttled to one animation frame per burst. Each frame it
 * writes two custom properties on `<html>`:
 *   --p       0..1 progress through the whole page
 *   --hero-p  0..1 progress through the first viewport height (the hero)
 * CSS uses them as a fallback where `animation-timeline` is missing; the 3D
 * scene (and later the fluid layer) subscribes for its camera path.
 * Everything is a no-op on the server.
 */
export type ScrollState = { p: number; heroP: number };

type Listener = (s: ScrollState) => void;

const listeners = new Set<Listener>();
let attached = false;
let frame = 0;
let state: ScrollState = { p: 0, heroP: 0 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function measure(): ScrollState {
  const y = window.scrollY || window.pageYOffset || 0;
  const vh = window.innerHeight || 1;
  const max = Math.max(1, (document.documentElement.scrollHeight || 0) - vh);
  return { p: clamp01(y / max), heroP: clamp01(y / vh) };
}

function update(): void {
  state = measure();
  const style = document.documentElement.style;
  style.setProperty("--p", String(state.p));
  style.setProperty("--hero-p", String(state.heroP));
}

function apply(): void {
  frame = 0;
  update();
  for (const cb of listeners) cb(state);
}

function onScroll(): void {
  if (frame) return;
  frame = window.requestAnimationFrame(apply);
}

function attach(): void {
  if (attached) return;
  attached = true;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}

function detach(): void {
  if (!attached) return;
  attached = false;
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onScroll);
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
}

/** The last measured state (measured now if nothing is listening yet). */
export function getScrollState(): ScrollState {
  if (typeof window === "undefined") return state;
  return attached ? state : measure();
}

/**
 * Calls `cb` with `{ p, heroP }` now and on every throttled scroll or resize.
 * Returns the unsubscribe function. The listener detaches when nobody listens.
 */
export function subscribeScroll(cb: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(cb);
  attach();
  update();
  cb(state);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) detach();
  };
}
