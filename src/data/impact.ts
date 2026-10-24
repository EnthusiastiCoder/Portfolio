/**
 * Measured impact per product, for the red pill. Every figure here must come
 * from research/impact-metrics/README.md, worded exactly as measured, with the
 * method that produced it. Never invent, round up or estimate a number: an
 * empty list renders nothing.
 */
export interface ImpactMetric {
  /** What was measured, in plain words, e.g. "Lighthouse performance, desktop". */
  label: string;
  /** The figure exactly as measured, e.g. "100". */
  value: string;
  /** How it was measured, shown as a footnote under the figure. */
  method: string;
}

// TODO(impact-metrics): research/impact-metrics/README.md was not finished when
// this was written. Fill each slot from that file only, then delete this note.
export const impact: Record<string, ImpactMetric[]> = {
  nopload: [],
  foreverqr: [],
  quietpdf: [],
  framelab: [],
  syncplay: [],
};

/** The measured figures for a product (empty when none are sourced yet). */
export function getImpact(slug: string): ImpactMetric[] {
  return impact[slug] ?? [];
}
