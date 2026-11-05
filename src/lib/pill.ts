/**
 * The red/blue pill mode. Red is DEPTH (engineering, architecture, trade-offs),
 * blue is SURFACE (visuals first, concise), both is the blend. The mode lives on
 * `<html data-pill>` so CSS gates content from server HTML with no layout shift.
 * `<html data-pill-chosen="true">` marks an explicit choice (URL param, stored
 * choice or click); the implicit "both" from scrolling past never sets it.
 */
export type Pill = "red" | "blue" | "both";

export const PILLS: readonly Pill[] = ["red", "blue", "both"] as const;
export const PILL_STORAGE_KEY = "matrix-pill";
export const PILL_EVENT = "matrix-pill";
export const PILL_PARAM = "pill";
/** Total glitch transition length; the mode switches at the midpoint. */
export const GLITCH_MS = 450;

export function isPill(v: unknown): v is Pill {
  return v === "red" || v === "blue" || v === "both";
}

/** Reads `pill=` from a query string, with or without the leading "?". Exact lowercase only. */
export function parsePillParam(search: string): Pill | null {
  const value = new URLSearchParams(search).get(PILL_PARAM);
  return isPill(value) ? value : null;
}

/** URL param beats the stored choice; neither means "both", not chosen. */
export function resolveInitialPill(i: { param: Pill | null; stored: Pill | null }): {
  pill: Pill;
  chosen: boolean;
} {
  const pill = i.param ?? i.stored;
  return pill ? { pill, chosen: true } : { pill: "both", chosen: false };
}

/** Path + search + hash (no origin) with `pill=<p>` set once, other params and the hash kept. */
export function withPillParam(href: string, pill: Pill): string {
  const url = new URL(href, "http://localhost");
  url.searchParams.set(PILL_PARAM, pill);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Runs inline in `<head>` before first paint: `?pill=` param, then the stored
 * choice, then "both" (not chosen). A param is never written to storage here.
 * Kept tiny and dependency-free.
 */
export const pillBootScript = `(function(){var d=document.documentElement,p=null,s=null;function ok(v){return v==="red"||v==="blue"||v==="both"}try{var m=/[?&]${PILL_PARAM}=([^&#]*)/.exec(location.search);if(m&&ok(m[1]))p=m[1]}catch(e){}try{var v=localStorage.getItem("${PILL_STORAGE_KEY}");if(ok(v))s=v}catch(e){}var c=p||s;d.dataset.pill=c||"both";if(c)d.dataset.pillChosen="true"})();`;

export function readPill(): Pill | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.pill;
  return isPill(value) ? value : null;
}

export function isPillChosen(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.pillChosen === "true";
}

/**
 * Applies a mode and notifies listeners. `persist` (default true) stores it and
 * marks it as chosen; `updateUrl` (default true) reflects it as `?pill=`.
 */
export function writePill(p: Pill, o: { persist?: boolean; updateUrl?: boolean } = {}): void {
  const { persist = true, updateUrl = true } = o;
  const root = document.documentElement;
  root.dataset.pill = p;
  if (persist) {
    root.dataset.pillChosen = "true";
    try {
      localStorage.setItem(PILL_STORAGE_KEY, p);
    } catch {
      // Storage can be unavailable (private mode, quota); the mode still applies for this page.
    }
  }
  if (updateUrl) {
    try {
      window.history.replaceState(window.history.state, "", withPillParam(window.location.href, p));
    } catch {
      // Some sandboxed frames refuse history writes; the mode still applies.
    }
  }
  window.dispatchEvent(new CustomEvent<Pill>(PILL_EVENT, { detail: p }));
}

export function subscribePill(cb: () => void): () => void {
  window.addEventListener(PILL_EVENT, cb);
  return () => window.removeEventListener(PILL_EVENT, cb);
}

let applyTimer: ReturnType<typeof setTimeout> | undefined;
let clearTimer: ReturnType<typeof setTimeout> | undefined;

function glitchAllowed(): boolean {
  if (document.documentElement.dataset.effects !== "full") return false;
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Switches the mode. With full effects and motion allowed it plays the page
 * glitch: `data-glitch="on"` now, the mode at GLITCH_MS / 2, the glitch removed
 * at GLITCH_MS. Otherwise it applies at once and never sets `data-glitch`.
 */
export function switchPill(p: Pill, o?: { persist?: boolean; updateUrl?: boolean }): void {
  clearTimeout(applyTimer);
  clearTimeout(clearTimer);
  const root = document.documentElement;
  if (!glitchAllowed()) {
    if (root.hasAttribute("data-glitch")) delete root.dataset.glitch;
    writePill(p, o);
    return;
  }
  root.dataset.glitch = "on";
  applyTimer = setTimeout(() => writePill(p, o), GLITCH_MS / 2);
  clearTimer = setTimeout(() => {
    delete root.dataset.glitch;
  }, GLITCH_MS);
}
