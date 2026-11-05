/**
 * How the fluid dye shows. "chars" (the default): the dye shows only through
 * the falling 0/1 rain digits, everything between them stays dark. "smoke":
 * the full smoky dye over the page. The choice persists in localStorage and
 * lives on `<html data-fluid-mode>` so CSS can switch the compositing. Kept
 * dependency-free so the toggle can ship in first load.
 */
export type FluidMode = "chars" | "smoke";

export const FLUID_MODE_STORAGE_KEY = "portfolio-fluid-mode";
export const FLUID_MODE_EVENT = "portfolio-fluid-mode";
export const DEFAULT_FLUID_MODE: FluidMode = "chars";

export function isFluidMode(value: unknown): value is FluidMode {
  return value === "chars" || value === "smoke";
}

export function readFluidMode(storage: Pick<Storage, "getItem"> | null = safeStorage()): FluidMode {
  try {
    const v = storage?.getItem(FLUID_MODE_STORAGE_KEY);
    return isFluidMode(v) ? v : DEFAULT_FLUID_MODE;
  } catch {
    return DEFAULT_FLUID_MODE;
  }
}

export function writeFluidMode(
  mode: FluidMode,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  try {
    storage?.setItem(FLUID_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable (private mode, quota); the toggle still works for this page.
  }
}

/** Mirrors the mode onto <html> and tells the fluid layer. */
export function applyFluidMode(mode: FluidMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fluidMode = mode;
  window.dispatchEvent(new Event(FLUID_MODE_EVENT));
}

export function subscribeFluidMode(callback: () => void): () => void {
  window.addEventListener(FLUID_MODE_EVENT, callback);
  return () => window.removeEventListener(FLUID_MODE_EVENT, callback);
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
