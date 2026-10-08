import { projects, type Project } from "@/data/projects";
import { projectLinks } from "@/config/project-links";

/** All projects, newest first. */
export function getAllProjects(): Project[] {
  return [...projects].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Featured projects, newest first. */
export function getFeaturedProjects(): Project[] {
  return getAllProjects().filter((p) => p.featured);
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export type ProjectLink = { kind: "live"; href: string } | { kind: "private"; label: string };

export function getProjectLink(slug: string): ProjectLink {
  const entry = projectLinks[slug];
  if (entry?.state === "live") return { kind: "live", href: entry.url };
  return { kind: "private", label: "Private beta, launching soon" };
}
