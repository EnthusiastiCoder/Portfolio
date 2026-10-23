import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";
import * as projectLib from "@/lib/projects";
import { formatSource, getAllProjects, getProjectBySlug, getProjectLink } from "@/lib/projects";

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CONTENT_DIR = path.resolve(process.cwd(), "src/content/projects");
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

const ORDER = ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"];
const TOOL_SITES = ["nopload", "foreverqr", "quietpdf", "framelab"];
const TOOL_URLS: Record<string, string> = {
  nopload: "https://nopload-92m.pages.dev",
  foreverqr: "https://foreverqr-anu.pages.dev",
  quietpdf: "https://quietpdf-279.pages.dev",
  framelab: "https://framelab-2f4.pages.dev",
};
const SYNCPLAY_URL = "https://github.com/EnthusiastiCoder/SyncPlay";
const CTA_LABELS: Record<string, string> = {
  nopload: "Open Nopload",
  foreverqr: "Open ForeverQR",
  quietpdf: "Open QuietPDF",
  framelab: "Open Framelab",
  syncplay: "Get SyncPlay",
};

type Availability = { state: "live"; url: string } | { state: "private" };

/** v2 project fields (plan WS4). Cast so the file typechecks before the data exists. */
type V2Project = {
  slug: string;
  audience?: string;
  story?: string;
  design?: string[];
  primaryCta?: { label: string; href: string };
  diagram?: {
    nodes: { id: string; label: string; x: number; y: number }[];
    edges: { from: string; to: string; label?: string }[];
  };
  hardProblems?: { problem: string; approach: string; source: string }[];
  perf?: { label: string; value: string; source: string }[];
  stack?: string[];
};
const v2 = () => projects as unknown as V2Project[];

async function loadProjectLinks(): Promise<Record<string, Availability>> {
  const mod = await import("@/config/project-links");
  expect(mod.projectLinks, "projectLinks export").toBeDefined();
  return mod.projectLinks as Record<string, Availability>;
}

describe("projects data", () => {
  // Case 31
  it("has exactly 5 valid projects", () => {
    expect(projects.length).toBe(5);

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

  it("retires the placeholder projects", () => {
    const slugs = projects.map((p) => p.slug);
    expect(slugs).not.toContain("project-info-server");
    expect(slugs).not.toContain("profile-readme-updater");
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

  it("gives each of the 4 tool sites at least one screenshot", () => {
    for (const slug of TOOL_SITES) {
      const p = projects.find((x) => x.slug === slug);
      expect(p, slug).toBeDefined();
      expect((p!.screenshots ?? []).length, `${slug} screenshots`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("project helpers", () => {
  // T19
  it("getAllProjects returns the 5 products in showcase order", () => {
    expect(getAllProjects().map((p) => p.slug)).toEqual(ORDER);
  });

  // T19
  it("drops matrix-portfolio", () => {
    expect(projects.map((p) => p.slug)).not.toContain("matrix-portfolio");
    expect(getProjectBySlug("matrix-portfolio")).toBeUndefined();
  });

  it("getProjectBySlug finds an existing project and returns undefined otherwise", () => {
    const first = projects[0];
    expect(getProjectBySlug(first.slug)).toEqual(first);
    expect(getProjectBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("formatSource", () => {
  it("turns README anchors into plain words", () => {
    expect(formatSource("Nopload README.md#How privacy is verifiable")).toBe(
      "Nopload README: How privacy is verifiable",
    );
    expect(formatSource("SyncPlay README.md#WLRC Format, #Project Structure")).toBe(
      "SyncPlay README: WLRC Format, Project Structure",
    );
    expect(formatSource("A plain note")).toBe("A plain note");
  });

  it("leaves no README.md# anchors in any rendered project source", () => {
    for (const p of projects) {
      const sources = [...p.perf.map((f) => f.source), ...p.hardProblems.map((h) => h.source)];
      for (const source of sources) expect(formatSource(source)).not.toMatch(/\.md|#/);
    }
  });
});

describe("project link state", () => {
  it("has an entry for every project and none for matrix-portfolio", async () => {
    const links = await loadProjectLinks();
    for (const p of projects) expect(links[p.slug], p.slug).toBeDefined();
    expect(Object.keys(links)).not.toContain("matrix-portfolio");
  });

  it("has the 4 tool sites live", async () => {
    const links = await loadProjectLinks();
    for (const slug of TOOL_SITES) {
      expect(links[slug], slug).toEqual({ state: "live", url: TOOL_URLS[slug] });
    }
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

  it("getProjectLink maps live and unknown slugs", () => {
    expect(getProjectLink("nopload")).toEqual({ kind: "live", href: TOOL_URLS.nopload });
    expect(getProjectLink("syncplay")).toEqual({ kind: "live", href: SYNCPLAY_URL });
    expect(getProjectLink("does-not-exist").kind).toBe("private");
  });
});

// T20
describe("project story and primary CTA", () => {
  it("gives every project a non-empty audience and story and 2-4 design notes", () => {
    for (const p of v2()) {
      expect(typeof p.audience, `${p.slug}.audience`).toBe("string");
      expect(p.audience!.trim(), `${p.slug}.audience`).not.toBe("");
      expect(typeof p.story, `${p.slug}.story`).toBe("string");
      expect(p.story!.trim(), `${p.slug}.story`).not.toBe("");
      expect(Array.isArray(p.design), `${p.slug}.design`).toBe(true);
      expect(p.design!.length, `${p.slug}.design`).toBeGreaterThanOrEqual(2);
      expect(p.design!.length, `${p.slug}.design`).toBeLessThanOrEqual(4);
      for (const d of p.design!) expect(d.trim(), `${p.slug}.design entry`).not.toBe("");
    }
  });

  it("gives every project the exact primary CTA label and the configured href", async () => {
    const links = await loadProjectLinks();
    for (const p of v2()) {
      expect(p.primaryCta, `${p.slug}.primaryCta`).toBeDefined();
      expect(p.primaryCta!.label, `${p.slug} label`).toBe(CTA_LABELS[p.slug]);
      const link = links[p.slug];
      expect(link?.state, `${p.slug} link state`).toBe("live");
      if (link?.state === "live") expect(p.primaryCta!.href, `${p.slug} href`).toBe(link.url);
    }
  });

  it("points the 4 tool-site CTAs at https *.pages.dev", () => {
    for (const slug of TOOL_SITES) {
      const p = v2().find((x) => x.slug === slug);
      expect(p?.primaryCta?.href, slug).toMatch(/^https:\/\/[a-z0-9-]+\.pages\.dev\/?$/);
    }
  });

  it("exposes getPrimaryCta(project) equal to project.primaryCta", () => {
    const getPrimaryCta = (projectLib as Record<string, unknown>).getPrimaryCta as
      ((p: unknown) => unknown) | undefined;
    expect(typeof getPrimaryCta, "getPrimaryCta export").toBe("function");
    for (const p of v2()) expect(getPrimaryCta!(p), p.slug).toEqual(p.primaryCta);
  });
});

// T21
describe("project engineering depth", () => {
  it("gives every project a 4-8 node diagram with valid edges", () => {
    for (const p of v2()) {
      expect(p.diagram, `${p.slug}.diagram`).toBeDefined();
      const { nodes, edges } = p.diagram!;
      expect(nodes.length, `${p.slug} nodes`).toBeGreaterThanOrEqual(4);
      expect(nodes.length, `${p.slug} nodes`).toBeLessThanOrEqual(8);
      const ids = nodes.map((n) => n.id);
      expect(new Set(ids).size, `${p.slug} unique node ids`).toBe(ids.length);
      for (const n of nodes) {
        expect(n.x, `${p.slug}.${n.id}.x`).toBeGreaterThanOrEqual(0);
        expect(n.x, `${p.slug}.${n.id}.x`).toBeLessThanOrEqual(100);
        expect(n.y, `${p.slug}.${n.id}.y`).toBeGreaterThanOrEqual(0);
        expect(n.y, `${p.slug}.${n.id}.y`).toBeLessThanOrEqual(100);
      }
      expect(edges.length, `${p.slug} edges`).toBeGreaterThan(0);
      for (const e of edges) {
        expect(ids, `${p.slug} edge from ${e.from}`).toContain(e.from);
        expect(ids, `${p.slug} edge to ${e.to}`).toContain(e.to);
      }
    }
  });

  it("gives every project 2-3 sourced hard problems", () => {
    for (const p of v2()) {
      expect(Array.isArray(p.hardProblems), `${p.slug}.hardProblems`).toBe(true);
      expect(p.hardProblems!.length, `${p.slug}.hardProblems`).toBeGreaterThanOrEqual(2);
      expect(p.hardProblems!.length, `${p.slug}.hardProblems`).toBeLessThanOrEqual(3);
      for (const h of p.hardProblems!) {
        expect(h.problem.trim(), `${p.slug} problem`).not.toBe("");
        expect(h.approach.trim(), `${p.slug} approach`).not.toBe("");
        expect(h.source.trim(), `${p.slug} source`).not.toBe("");
      }
    }
  });

  it("gives every project 0-4 sourced perf entries and a non-empty stack", () => {
    for (const p of v2()) {
      expect(Array.isArray(p.perf), `${p.slug}.perf`).toBe(true);
      expect(p.perf!.length, `${p.slug}.perf`).toBeLessThanOrEqual(4);
      for (const m of p.perf!) {
        expect(m.label.trim(), `${p.slug} perf label`).not.toBe("");
        expect(m.value.trim(), `${p.slug} perf value`).not.toBe("");
        expect(m.source.trim(), `${p.slug} perf source`).not.toBe("");
      }
      expect(Array.isArray(p.stack), `${p.slug}.stack`).toBe(true);
      expect(p.stack!.length, `${p.slug}.stack`).toBeGreaterThan(0);
    }
  });
});
