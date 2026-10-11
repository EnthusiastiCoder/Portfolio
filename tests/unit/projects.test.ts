import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";
import {
  getAllProjects,
  getFeaturedProjects,
  getProjectBySlug,
  getProjectLink,
} from "@/lib/projects";

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

  it("getFeaturedProjects returns only featured projects in the same order", () => {
    const expected = getAllProjects().filter((p) => p.featured);
    const featured = getFeaturedProjects();
    expect(featured.every((p) => p.featured)).toBe(true);
    expect(featured.map((p) => p.slug)).toEqual(expected.map((p) => p.slug));
  });

  it("getProjectBySlug finds an existing project and returns undefined otherwise", () => {
    const first = projects[0];
    expect(getProjectBySlug(first.slug)).toEqual(first);
    expect(getProjectBySlug("does-not-exist")).toBeUndefined();
  });
});

// T6 (WS2): real featured projects, screenshots and link state.
const FEATURED = ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"];
const TOOL_SITES = ["nopload", "foreverqr", "quietpdf", "framelab"];
const TOOL_URLS: Record<string, string> = {
  nopload: "https://nopload-92m.pages.dev",
  foreverqr: "https://foreverqr-anu.pages.dev",
  quietpdf: "https://quietpdf-279.pages.dev",
  framelab: "https://framelab-2f4.pages.dev",
};
const SYNCPLAY_URL = "https://github.com/EnthusiastiCoder/SyncPlay";
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

type Availability = { state: "live"; url: string } | { state: "private" };

/** Loaded lazily so cases 31-33 keep running while src/config/project-links.ts is missing. */
async function loadProjectLinks(): Promise<Record<string, Availability>> {
  const mod = await import("@/config/project-links");
  expect(mod.projectLinks, "projectLinks export").toBeDefined();
  return mod.projectLinks as Record<string, Availability>;
}

const featuredProjects = () => projects.filter((p) => p.featured);

describe("featured projects content", () => {
  it("features exactly nopload, foreverqr, quietpdf, framelab and syncplay", () => {
    expect(
      featuredProjects()
        .map((p) => p.slug)
        .sort(),
    ).toEqual([...FEATURED].sort());
  });

  it("retires the placeholder projects", () => {
    const slugs = projects.map((p) => p.slug);
    expect(slugs).not.toContain("project-info-server");
    expect(slugs).not.toContain("profile-readme-updater");
  });

  it("gives every featured project a tagline, 1-3 highlights and sourced depth", () => {
    for (const p of featuredProjects()) {
      expect(typeof p.tagline, `${p.slug}.tagline`).toBe("string");
      expect(p.tagline!.trim().length, `${p.slug}.tagline`).toBeGreaterThan(0);

      expect(Array.isArray(p.highlights), `${p.slug}.highlights`).toBe(true);
      expect(p.highlights!.length, `${p.slug}.highlights`).toBeGreaterThanOrEqual(1);
      expect(p.highlights!.length, `${p.slug}.highlights`).toBeLessThanOrEqual(3);

      expect(p.depth, `${p.slug}.depth`).toBeDefined();
      expect(p.depth!.architecture.length, `${p.slug}.depth.architecture`).toBeGreaterThanOrEqual(
        2,
      );
      expect(p.depth!.tradeoffs.length, `${p.slug}.depth.tradeoffs`).toBeGreaterThanOrEqual(1);
      expect(p.depth!.facts.length, `${p.slug}.depth.facts`).toBeGreaterThanOrEqual(1);
      for (const f of p.depth!.facts) {
        expect(f.label.trim(), `${p.slug} fact label`).not.toBe("");
        expect(f.detail.trim(), `${p.slug} fact detail`).not.toBe("");
        expect(f.source.trim(), `${p.slug} fact source`).not.toBe("");
      }
    }
  });

  it("points every screenshot at an existing file under public/projects/<slug>/ with alt and size", () => {
    for (const p of projects) {
      for (const s of p.screenshots ?? []) {
        expect(s.src.startsWith(`/projects/${p.slug}/`), s.src).toBe(true);
        expect(existsSync(path.join(PUBLIC_DIR, s.src)), `public${s.src}`).toBe(true);
        expect(s.alt.trim(), `${s.src} alt`).not.toBe("");
        expect(Number.isInteger(s.width) && s.width > 0, `${s.src} width`).toBe(true);
        expect(Number.isInteger(s.height) && s.height > 0, `${s.src} height`).toBe(true);
      }
    }
  });

  it("has at least 4 featured projects with a screenshot", () => {
    const withShots = featuredProjects().filter((p) => (p.screenshots ?? []).length >= 1);
    expect(withShots.length).toBeGreaterThanOrEqual(4);
  });
});

describe("project link state", () => {
  it("has an entry for every project", async () => {
    const links = await loadProjectLinks();
    for (const p of projects) expect(links[p.slug], p.slug).toBeDefined();
  });

  it("keeps the 4 tool sites private", async () => {
    const links = await loadProjectLinks();
    for (const slug of TOOL_SITES) expect(links[slug], slug).toEqual({ state: "live", url: TOOL_URLS[slug] });
  });

  it("has syncplay live on GitHub", async () => {
    const links = await loadProjectLinks();
    expect(links.syncplay).toEqual({ state: "live", url: SYNCPLAY_URL });
  });

  it("uses https for every live url", async () => {
    const links = await loadProjectLinks();
    for (const [slug, a] of Object.entries(links)) {
      if (a.state === "live") expect(a.url.startsWith("https://"), `${slug}: ${a.url}`).toBe(true);
    }
  });

  it("getProjectLink maps private, live and unknown slugs", () => {
    expect(typeof getProjectLink).toBe("function");
    expect(getProjectLink("nopload")).toEqual({
      kind: "live",
      href: TOOL_URLS.nopload,
    });
    expect(getProjectLink("syncplay")).toEqual({ kind: "live", href: SYNCPLAY_URL });
    expect(getProjectLink("does-not-exist").kind).toBe("private");
  });
});
