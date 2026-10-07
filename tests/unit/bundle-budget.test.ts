import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  FIRST_LOAD_BUDGET_BYTES,
  extractScriptSrcs,
  gzipBytes,
  measureFirstLoad,
} from "../../scripts/bundle-budget.mjs";

// T8 (WS3): the first-load JS budget script.

const FIXTURE_HTML = `<!DOCTYPE html><html><head>
<script src="/_next/static/chunks/webpack-a1.js" async=""></script>
<script>self.__next_f=self.__next_f||[];self.__next_f.push([0])</script>
<script src="https://cdn.example.com/lib.js"></script>
<script async src="/_next/static/chunks/main-app-b2.js"></script>
<script src="/_next/static/chunks/webpack-a1.js"></script>
<script src="/favicon-helper.js"></script>
</head><body><h1>Arpan Mandal</h1>
<script src="/_next/static/chunks/app/page-c3.js" async=""></script>
<script>console.log("inline")</script>
</body></html>`;

const EXPECTED_SRCS = [
  "/_next/static/chunks/webpack-a1.js",
  "/_next/static/chunks/main-app-b2.js",
  "/_next/static/chunks/app/page-c3.js",
];

describe("bundle budget script", () => {
  it("sets the budget to 215040 bytes (210 KiB gzip)", () => {
    expect(FIRST_LOAD_BUDGET_BYTES).toBe(215040);
  });

  it("extractScriptSrcs returns unique /_next/static/ srcs in document order", () => {
    expect(extractScriptSrcs(FIXTURE_HTML)).toEqual(EXPECTED_SRCS);
  });

  it("extractScriptSrcs returns an empty list when there are no Next scripts", () => {
    expect(
      extractScriptSrcs('<script>1</script><script src="https://cdn.example.com/a.js"></script>'),
    ).toEqual([]);
  });

  it("gzipBytes compresses 10,000 'a' to between 1 and 199 bytes", () => {
    const n = gzipBytes(Buffer.from("a".repeat(10_000)));
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(200);
  });

  it("gzipBytes matches zlib level 9", () => {
    const buf = Buffer.from("const x = 1;\n".repeat(500));
    expect(gzipBytes(buf)).toBe(zlib.gzipSync(buf, { level: 9 }).length);
  });

  it("measureFirstLoad gzips each unique script once and sums the sizes", async () => {
    const assets: Record<string, Buffer> = {
      [EXPECTED_SRCS[0]]: Buffer.from("w".repeat(3_000) + "webpack runtime"),
      [EXPECTED_SRCS[1]]: Buffer.from(
        Array.from({ length: 2_000 }, (_, i) => `m${i * 7919}`).join(","),
      ),
      [EXPECTED_SRCS[2]]: Buffer.from("export default function Page(){return null}\n".repeat(40)),
    };
    const readAsset = vi.fn(async (src: string) => {
      const buf = assets[src];
      if (!buf) throw new Error(`unexpected asset ${src}`);
      return buf;
    });

    const result = await measureFirstLoad({ html: FIXTURE_HTML, readAsset });

    const expectedFiles = EXPECTED_SRCS.map((src) => ({
      src,
      gzip: zlib.gzipSync(assets[src], { level: 9 }).length,
    }));
    expect(result.files).toEqual(expectedFiles);
    expect(result.total).toBe(expectedFiles.reduce((sum, f) => sum + f.gzip, 0));
    expect(readAsset).toHaveBeenCalledTimes(3);
  });

  it("package.json has a budget script running scripts/bundle-budget.mjs", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
    expect(typeof pkg.scripts?.budget).toBe("string");
    expect(pkg.scripts.budget).toContain("scripts/bundle-budget.mjs");
  });
});
