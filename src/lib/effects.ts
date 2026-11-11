/**
 * Effects level chosen with the red/blue pill. "full" runs the rain and the
 * glitch effects; "calm" keeps a static rain frame and turns the effects off.
 * The level lives on `<html data-effects>` so CSS can gate effects without JS.
 */
export type EffectsLevel = "full" | "calm";

export const EFFECTS_STORAGE_KEY = "matrix-effects";
export const EFFECTS_EVENT = "matrix-effects";

export function isEffectsLevel(value: unknown): value is EffectsLevel {
  return value === "full" || value === "calm";
}

/**
 * Runs inline in `<head>` before first paint: stored choice, else calm under
 * reduced motion or Save-Data, else full. Kept tiny and dependency-free.
 */
export const effectsBootScript = `(function(){var d=document.documentElement;try{var v=localStorage.getItem("${EFFECTS_STORAGE_KEY}");if(v!=="full"&&v!=="calm"){var c=navigator.connection;v=matchMedia("(prefers-reduced-motion: reduce)").matches||(c&&c.saveData)?"calm":"full"}d.dataset.effects=v}catch(e){d.dataset.effects="full"}})();`;

export function readEffects(): EffectsLevel | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.effects;
  return isEffectsLevel(value) ? value : null;
}

/** Applies a level, persists it, and notifies listeners (the rain and the pills). */
export function writeEffects(level: EffectsLevel): void {
  document.documentElement.dataset.effects = level;
  try {
    localStorage.setItem(EFFECTS_STORAGE_KEY, level);
  } catch {
    // Storage can be unavailable (private mode, quota); the level still applies for this page.
  }
  window.dispatchEvent(new CustomEvent<EffectsLevel>(EFFECTS_EVENT, { detail: level }));
}
