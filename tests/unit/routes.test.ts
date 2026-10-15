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
