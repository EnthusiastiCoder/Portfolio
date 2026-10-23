import { projects, type Cta, type Project } from "@/data/projects";
import { projectLinks } from "@/config/project-links";

/** The showcase order: the 4 tool sites, then SyncPlay. */
const ORDER = ["nopload", "foreverqr", "quietpdf", "framelab", "syncplay"];

function rank(slug: string): number {
  const i = ORDER.indexOf(slug);
  return i === -1 ? ORDER.length : i;
}

/** All products, in showcase order. */
export function getAllProjects(): Project[] {
  return [...projects].sort((a, b) => rank(a.slug) - rank(b.slug));
}

/** Featured products, in showcase order. */
export function getFeaturedProjects(): Project[] {
  return getAllProjects().filter((p) => p.featured);
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/** The main button for a product: the live site, or "Get SyncPlay". */
export function getPrimaryCta(project: Project): Cta {
  return project.primaryCta;
}

export type ProjectLink = { kind: "live"; href: string } | { kind: "private"; label: string };

export function getProjectLink(slug: string): ProjectLink {
  const entry = projectLinks[slug];
  if (entry?.state === "live") return { kind: "live", href: entry.url };
  return { kind: "private", label: "Private beta, launching soon" };
}

/**
 * A source reference in plain words: "Nopload README.md#Features, #Stack"
 * reads "Nopload README: Features, Stack". Anything else is returned as is.
 */
export function formatSource(source: string): string {
  const match = /^(.*?)\s*README\.md#(.*)$/.exec(source);
  if (!match) return source;
  const sections = match[2]
    .split(/,\s*#?/)
    .map((s) => s.trim())
    .filter(Boolean);
  return `${match[1]} README: ${sections.join(", ")}`.trim();
}
