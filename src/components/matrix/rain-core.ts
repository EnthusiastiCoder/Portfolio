/**
 * Pure digital-rain drawing step, shared by the OffscreenCanvas worker and the
 * main-thread fallback. No DOM access: it only needs a 2D context.
 */

export type Rain2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface RainPalette {
  background: string;
  accent: string;
  accentDim: string;
  rainHead: string;
}

export interface RainStyle {
  glyphs: string;
  fontSize: number;
  fontFamily: string;
  colors: RainPalette;
}

export interface RainState {
  /** CSS-pixel size of the drawing area. */
  width: number;
  height: number;
  /** Horizontal distance between columns, in CSS pixels. */
  step: number;
  rows: number;
  /** Current head row per column (fractional). */
  drops: Float32Array;
  /** Rows advanced per frame per column. */
  speeds: Float32Array;
  /** Last row drawn per column, so its glyph can be repainted as trail. */
  lastRow: Int32Array;
  /** Glyph index drawn at `lastRow`, reused for the trail repaint. */
  lastGlyph: Int32Array;
  random: () => number;
}

/** Small deterministic PRNG (mulberry32), so static frames are identical every time. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Number of columns for a width: about one per `fontSize` px at density 1. */
export function columnCount(width: number, fontSize: number, density: number): number {
  return Math.max(1, Math.floor((width / fontSize) * density));
}
