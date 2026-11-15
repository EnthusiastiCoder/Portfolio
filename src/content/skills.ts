export interface SkillGroup {
  label: string;
  items: string[];
}

// Placeholder skills: replace with real details before launch.
export const skills: SkillGroup[] = [
  { label: "Languages", items: ["TypeScript", "JavaScript", "Python", "SQL"] },
  { label: "Frontend", items: ["React", "Next.js", "Tailwind CSS", "Motion"] },
  { label: "Backend", items: ["Node.js", "Bun", "REST", "GraphQL"] },
  { label: "Tooling", items: ["Git", "GitHub Actions", "Vitest", "Playwright"] },
];
