import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { siteConfig } from "@/config/site";
import { projects } from "@/data/projects";

function readSource(rel: string): string {
  return readFileSync(path.resolve(process.cwd(), rel), "utf8");
}

describe("route files", () => {
  // Case 34 (WS1)
  it("home page declares a static ISR revalidate of 21600", () => {
    expect(readSource("src/app/page.tsx")).toContain("export const revalidate = 21600;");
  });

  // Case 35 (WS2)
  it("project detail page declares revalidate 21600 and dynamicParams = false", () => {
    const src = readSource("src/app/projects/[slug]/page.tsx");
    expect(src).toContain("export const revalidate = 21600;");
    expect(src).toContain("dynamicParams = false");
  });
});

describe("sitemap", () => {
  // Case 36 (WS2)
  it("lists the home page and every project with absolute https URLs", async () => {
    const mod = await import("@/app/sitemap");
    const entries = await mod.default();
    const urls = entries.map((e: { url: string }) => e.url);

    expect(urls.some((u: string) => u === siteConfig.url || u === `${siteConfig.url}/`)).toBe(
      true,
    );
    for (const p of projects) {
      expect(urls).toContain(`${siteConfig.url}/projects/${p.slug}`);
    }
    for (const u of urls) {
      expect(u.startsWith("https://")).toBe(true);
    }
  });
});

describe("robots", () => {
  // Case 37 (WS2)
  it("allows / for all user agents and points at the sitemap", async () => {
    const mod = await import("@/app/robots");
    const result = await mod.default();

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const asArray = (v: string | string[] | undefined) =>
      v === undefined ? [] : Array.isArray(v) ? v : [v];
    const allowsAll = rules.some(
      (r: { userAgent?: string | string[]; allow?: string | string[] }) =>
        asArray(r.userAgent).includes("*") && asArray(r.allow).includes("/"),
    );
    expect(allowsAll).toBe(true);
    expect(result.sitemap).toBe(`${siteConfig.url}/sitemap.xml`);
  });
});
