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
