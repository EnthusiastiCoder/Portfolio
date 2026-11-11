/**
 * Effects level chosen with the red/blue pill. "full" runs the rain and the
 * glitch effects; "calm" keeps a static rain frame and turns the effects off.
 * The level lives on `<html data-effects>` so CSS can gate effects without JS.
 */
export type EffectsLevel = "full" | "calm";
