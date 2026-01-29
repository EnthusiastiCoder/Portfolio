export interface Project {
  /** Kebab-case slug; matches `src/content/projects/<slug>.mdx`. */
  slug: string;
  title: string;
  summary: string;
  tech: string[];
  /** Month the project shipped, `YYYY-MM`. */
  date: string;
  featured: boolean;
  repo?: string;
  demo?: string;
}

// Placeholder projects: replace or extend with real work before launch.
export const projects: Project[] = [
  {
    slug: "matrix-portfolio",
    title: "Matrix Portfolio",
    summary:
      "This site: a statically rendered Next.js portfolio with a Matrix theme and GitHub and LeetCode stats refreshed every six hours.",
    tech: ["Next.js", "TypeScript", "Tailwind CSS", "Zod", "Vitest"],
    date: "2026-11",
    featured: true,
  },
  {
    slug: "project-info-server",
    title: "Project Info Server",
    summary:
      "A local, read-only dashboard that turns project notes and audits into visual pages with stacked detail modals and glossary hovers.",
    tech: ["Bun", "TypeScript", "HTML", "CSS"],
    date: "2026-10",
    featured: true,
  },
  {
    slug: "profile-readme-updater",
    title: "Profile README Updater",
    summary:
      "A scheduled GitHub Action that rewrites sections of a profile README with fresh LeetCode stats and recently pushed repositories.",
    tech: ["Node.js", "GitHub Actions", "GraphQL"],
    date: "2026-09",
    featured: false,
  },
];
