import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";
import { getAllProjects, getFeaturedProjects, getProjectBySlug } from "@/lib/projects";

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CONTENT_DIR = path.resolve(process.cwd(), "src/content/projects");

describe("projects data", () => {
  // Case 31
  it("has at least 3 valid projects, at least 2 featured", () => {
    expect(projects.length).toBeGreaterThanOrEqual(3);
    expect(projects.filter((p) => p.featured).length).toBeGreaterThanOrEqual(2);

    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const p of projects) {
      expect(p.slug).toMatch(KEBAB_RE);
      expect(p.date).toMatch(MONTH_RE);
      expect(p.tech.length).toBeGreaterThan(0);
    }
  });

  // Case 32
  it("has an MDX file for every project and no orphan MDX files", () => {
    for (const p of projects) {
      expect(existsSync(path.join(CONTENT_DIR, `${p.slug}.mdx`)), `${p.slug}.mdx`).toBe(true);
    }
    const mdxSlugs = readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""))
      .sort();
    expect(mdxSlugs).toEqual(projects.map((p) => p.slug).sort());
  });
});

describe("project helpers", () => {
  // Case 33
  it("getAllProjects returns all projects sorted by date desc", () => {
    const all = getAllProjects();
    expect(all).toHaveLength(projects.length);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].date >= all[i].date).toBe(true);
    }
  });
