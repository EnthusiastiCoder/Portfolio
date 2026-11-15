import type { RainFrameConfig, RainStyle } from "./rain-core";

/** Messages the page sends to the rain worker. */
export type RainWorkerMessage =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      style: RainStyle;
      config: RainFrameConfig;
      paused: boolean;
    }
  | { type: "configure"; config: RainFrameConfig }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "frames" };

/** Messages the rain worker sends back. */
export type RainWorkerReply = { type: "ready" } | { type: "frames"; count: number };
