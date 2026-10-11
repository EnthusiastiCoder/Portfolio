export type Availability = { state: "live"; url: string } | { state: "private" };

/**
 * Where each project can be tried. This is the one place to go live: replace
 * `{ state: "private" }` with `{ state: "live", url: "https://..." }` once a
 * deploy URL is confirmed. A private entry hides the link and shows a label.
 */
export const projectLinks: Record<string, Availability> = {
  nopload: { state: "live", url: "https://nopload-92m.pages.dev" },
  foreverqr: { state: "live", url: "https://foreverqr-anu.pages.dev" },
  quietpdf: { state: "live", url: "https://quietpdf-279.pages.dev" },
  framelab: { state: "live", url: "https://framelab-2f4.pages.dev" },
  syncplay: { state: "live", url: "https://github.com/EnthusiastiCoder/SyncPlay" },
  "matrix-portfolio": { state: "private" },
};
