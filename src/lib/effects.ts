/**
 * Effects level. "full" runs the rain and the glitch effects; "calm" keeps a
 * static rain frame and turns the effects off. It follows the visitor's motion
 * preferences only (reduced motion or Save-Data give calm); the pills no longer
 * change it, so glitches play in both modes. The level lives on
 * `<html data-effects>` so CSS can gate effects without JS.
 */
export type EffectsLevel = "full" | "calm";

export const EFFECTS_EVENT = "matrix-effects";

export function isEffectsLevel(value: unknown): value is EffectsLevel {
  return value === "full" || value === "calm";
}

/**
 * Runs inline in `<head>` before first paint: calm under reduced motion or
 * Save-Data, else full. Kept tiny, dependency-free and storage-free.
 */
export const effectsBootScript = `(function(){var d=document.documentElement;try{var c=navigator.connection;d.dataset.effects=matchMedia("(prefers-reduced-motion: reduce)").matches||(c&&c.saveData)?"calm":"full"}catch(e){d.dataset.effects="full"}})();`;

export function readEffects(): EffectsLevel | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.effects;
  return isEffectsLevel(value) ? value : null;
}

/** Applies a level for this page and notifies listeners (the rain and Reveal). Never stored. */
export function writeEffects(level: EffectsLevel): void {
  document.documentElement.dataset.effects = level;
  window.dispatchEvent(new CustomEvent<EffectsLevel>(EFFECTS_EVENT, { detail: level }));
}

export function subscribeEffects(callback: () => void): () => void {
  window.addEventListener(EFFECTS_EVENT, callback);
  return () => window.removeEventListener(EFFECTS_EVENT, callback);
}
