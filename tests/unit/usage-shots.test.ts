import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";

// WS1 (plans/2026-11-23_projects-deck-redesign.md): every product carries 3
// themed screenshots of real use, public/projects/<slug>/use-<n>.webp,
// 1600x1000 WebP of at most 300 KB, with a concrete alt and a short step caption.

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const MAX_BYTES = 300 * 1024;
const SHOT_W = 1600;
const SHOT_H = 1000;

type UsageShot = { src: string; alt: string; step: string; width: number; height: number };
/** Cast so the file typechecks before the `usage` field exists. */
const withUsage = () => projects as unknown as { slug: string; usage?: UsageShot[] }[];

/** Reads the pixel size from a WebP header (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(buf: Buffer): { width: number; height: number } {
  expect(buf.toString("ascii", 0, 4), "RIFF magic").toBe("RIFF");
  expect(buf.toString("ascii", 8, 12), "WEBP magic").toBe("WEBP");
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Frame tag (3 bytes) at 20, start code 9d 01 2a at 23, then 14-bit sizes.
    expect([buf[23], buf[24], buf[25]], "VP8 start code").toEqual([0x9d, 0x01, 0x2a]);
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    expect(buf[20], "VP8L signature").toBe(0x2f);
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`unknown WebP chunk "${chunk}"`);
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

describe("usage shots (WS1)", () => {
  it("US1: every project has 3 usage shots at /projects/<slug>/use-<n>.webp", () => {
    expect(withUsage()).toHaveLength(5);
    for (const p of withUsage()) {
      expect(p.usage, `${p.slug} usage`).toBeDefined();
      expect(p.usage, `${p.slug} usage`).toHaveLength(3);
      p.usage!.forEach((shot, i) => {
        expect(shot.src, `${p.slug} shot ${i + 1}`).toBe(`/projects/${p.slug}/use-${i + 1}.webp`);
      });
    }
  });

  it("US2: each file exists, is at most 300 KB and is a real 1600x1000 WebP", () => {
    for (const p of withUsage()) {
      expect(p.usage, `${p.slug} usage`).toHaveLength(3);
      for (const shot of p.usage!) {
        const file = path.join(PUBLIC_DIR, shot.src);
        expect(existsSync(file), `${shot.src} exists`).toBe(true);
        expect(statSync(file).size, `${shot.src} bytes`).toBeLessThanOrEqual(MAX_BYTES);
        const size = webpSize(readFileSync(file));
        expect(size, `${shot.src} pixel size`).toEqual({ width: SHOT_W, height: SHOT_H });
        expect(shot.width, `${shot.src} width`).toBe(size.width);
        expect(shot.height, `${shot.src} height`).toBe(size.height);
      }
    }
  });

  it("US3: alt is concrete (4+ words, distinct per product); step is 1-4 ASCII words", () => {
    for (const p of withUsage()) {
      expect(p.usage, `${p.slug} usage`).toHaveLength(3);
      const alts = p.usage!.map((s) => s.alt.trim());
      for (const shot of p.usage!) {
        expect(shot.alt.trim().length, `${shot.src} alt`).toBeGreaterThan(0);
        expect(
          words(shot.alt).length,
          `${shot.src} alt words: "${shot.alt}"`,
        ).toBeGreaterThanOrEqual(4);
        const n = words(shot.step).length;
        expect(n, `${shot.src} step words: "${shot.step}"`).toBeGreaterThanOrEqual(1);
        expect(n, `${shot.src} step words: "${shot.step}"`).toBeLessThanOrEqual(4);
        expect(shot.step, `${shot.src} step is plain ASCII`).toMatch(/^[\x20-\x7E]+$/);
      }
      expect(new Set(alts).size, `${p.slug} alts are distinct`).toBe(3);
    }
  });

  it("US4: the 15 srcs are all distinct", () => {
    const srcs = withUsage().flatMap((p) => (p.usage ?? []).map((s) => s.src));
    expect(srcs).toHaveLength(15);
    expect(new Set(srcs).size).toBe(15);
  });
});
