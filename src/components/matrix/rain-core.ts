/**
 * Pure digital-rain drawing step, shared by the OffscreenCanvas worker and the
 * main-thread fallback. No DOM access: it only needs a 2D context.
 */

export type Rain2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
