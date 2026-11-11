export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  /** Start month, `YYYY-MM`. */
  start: string;
  /** End month, `YYYY-MM`, or null for a current role. */
  end: string | null;
  location?: string;
  summary: string;
  highlights: string[];
  tech: string[];
}

// Placeholder entries: replace with real roles before launch.
export const experience: ExperienceItem[] = [
  {
    id: "software-engineer-current",
    role: "Software Engineer",
    company: "Product Company (placeholder)",
    start: "2023-07",
    end: null,
    location: "Remote",
    summary: "Building customer-facing web features and the internal tooling that ships them.",
    highlights: [
      "Led the migration of a legacy dashboard to Next.js, cutting page load time by about 40%.",
      "Introduced typed API clients and contract tests that caught breaking changes before release.",
      "Mentored two junior engineers through code review and pairing.",
    ],
    tech: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL"],
  },
  {
    id: "software-engineer-intern",
    role: "Software Engineering Intern",
    company: "Startup (placeholder)",
    start: "2022-05",
    end: "2023-06",
    location: "India",
    summary: "Worked on the core web app and its CI pipeline.",
    highlights: [
      "Built reusable form components used across five product areas.",
      "Set up automated end-to-end tests in CI, reducing manual QA time each release.",
    ],
    tech: ["JavaScript", "React", "Express", "GitHub Actions"],
  },
];
