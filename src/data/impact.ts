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
  /** The one figure red shows on the overview (one per product). */
  headline?: boolean;
}

// Every figure is from research/impact-metrics/README.md, measured on
// 2026-11-23 against the live sites or the local repos. Timings were taken
// while the laptop CPU was busy with other work, so they are upper bounds.
const LIGHTHOUSE =
  "Lighthouse 13.6, median of 5 runs on the live home page, measured on 23 Nov 2026.";
const BENCH =
  "Headless Chromium with the GPU off, timed from file in to result ready on the live site, with every request logged.";

export const impact: Record<string, ImpactMetric[]> = {
  nopload: [
    {
      label: "Bytes uploaded while compressing a photo",
      value: "0",
      method: `${BENCH} 0 non-GET requests and 0 request-body bytes over 4 runs.`,
    },
    {
      label: "Compress a 12 MP photo",
      value: "4.5 s",
      method: `${BENCH} Median of 3 warm runs (3.4 to 4.6 s). The same job also ran with the network off.`,
    },
    {
      label: "Smaller offline install after the precache trim",
      headline: true,
      value: "about 27x",
      method:
        "The old and new precache globs applied to the same build: 90 files and 11.67 MB down to 17 files and 0.43 MB.",
    },
    {
      label: "Lighthouse performance, desktop",
      value: "100",
      method: `${LIGHTHOUSE} 100 in all 5 runs, and 100 for accessibility, best practices and SEO.`,
    },
  ],
  foreverqr: [
    {
      label: "Third-party requests and cookies",
      value: "0 and 0",
      method: `${BENCH} Logged on the home page and while decoding.`,
    },
    {
      label: "Decode a QR image and give the expiry verdict",
      headline: true,
      value: "about 250 ms",
      method: `${BENCH} 253 ms median of 3 warm runs (238 to 321 ms).`,
    },
    {
      label: "Works offline",
      value: "Yes",
      method: "Network switched off and the tool reloaded: the verdict came back in 417 ms.",
    },
    {
      label: "Lighthouse performance, desktop",
      value: "100",
      method: `${LIGHTHOUSE} 100 for accessibility, best practices and SEO on every run.`,
    },
  ],
  quietpdf: [
    {
      label: "Merge 10 PDFs, 2,000 pages",
      headline: true,
      value: "2.45 s",
      method: `${BENCH} Median of 3 warm runs (2.34 to 2.59 s). The output was checked to have 2,000 pages.`,
    },
    {
      label: "Network requests after you drop the files",
      value: "0",
      method: `${BENCH} 0 requests of any kind over 4 merges.`,
    },
    {
      label: "Lighthouse performance, mobile and desktop",
      value: "100",
      method: `${LIGHTHOUSE} 100 for accessibility, best practices and SEO on every run.`,
    },
    {
      label: "Home page weight",
      value: "91 KB",
      method: "Bytes transferred in 12 requests, from the Lighthouse network log.",
    },
  ],
  framelab: [
    {
      label: "Smaller video from a 30 s 1080p clip",
      headline: true,
      value: "76%",
      method:
        "A 40.9 MB H.264 clip on the Small preset, in headless Edge with the GPU off: 9.7 MB out, still 1080p and 30 s, checked with ffprobe.",
    },
    {
      label: "Faster than real time",
      value: "2.3x",
      method: "The same 30 s clip compressed in 12.8 to 13.5 s over 3 runs, in the browser.",
    },
    {
      label: "Lighthouse performance, mobile and desktop",
      value: "100",
      method: `${LIGHTHOUSE} 100 for accessibility, best practices and SEO on every run.`,
    },
    {
      label: "Home page weight",
      value: "22.7 KB",
      method: "Bytes transferred in 9 requests, from the Lighthouse network log.",
    },
  ],
  syncplay: [
    {
      label: "Lyric overlay render time per frame",
      headline: true,
      value: "1.6 ms",
      method:
        "Median of 3,000 frames at 900 x 220 with word-level colouring: 4.8% of the 33 ms budget at 30 frames a second.",
    },
    {
      label: "Automated tests passing",
      value: "140 of 141",
      method:
        "pytest in a clean environment. The one failure needs the ML aligner, which was not installed.",
    },
    {
      label: "Embed and read lyrics in an MP3 tag",
      value: "39 ms",
      method: "Median round trip on a 3.7 MB MP3.",
    },
  ],
};

/** The overview's measured figure: the one marked headline, else the first. */
export function getHeadlineImpact(slug: string): ImpactMetric | undefined {
  const all = getImpact(slug);
  return all.find((m) => m.headline) ?? all[0];
}

/** The measured figures for a product (empty when none are sourced). */
export function getImpact(slug: string): ImpactMetric[] {
  return impact[slug] ?? [];
}
