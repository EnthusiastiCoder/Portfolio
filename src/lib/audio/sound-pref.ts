/**
 * Sound preference. Off by default; only an explicit toggle turns it on, and
 * the choice persists in localStorage. Kept dependency-free so it can ship in
 * first load while the audio engine itself stays lazy.
 */
export const SOUND_STORAGE_KEY = "portfolio-sound";

export function readSoundPref(storage: Pick<Storage, "getItem"> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(SOUND_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeSoundPref(
  on: boolean,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): void {
  try {
    storage?.setItem(SOUND_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage can be unavailable (private mode, quota); the toggle still works for this page.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
