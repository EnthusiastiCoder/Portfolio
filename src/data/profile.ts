import { siteConfig } from "@/config/site";

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface Profile {
  name: string;
  role: string;
  location: string;
  tagline: string;
  about: string[];
  skills: SkillGroup[];
}

// Placeholder copy: replace with real details before launch.
export const profile: Profile = {
  name: siteConfig.name,
  role: "Software Engineer",
  location: "India",
  tagline: "I build fast, accessible web apps and the tooling around them.",
  about: [
    "I am Arpan Mandal, a software engineer who enjoys turning rough ideas into reliable, well-tested products.",
    "I work across the stack with TypeScript, React and Node.js, and I care about performance, accessibility and clean developer tooling.",
    "Outside of work I solve algorithm problems on LeetCode and build small tools that automate my own workflow.",
  ],
  skills: [
    { label: "Languages", items: ["TypeScript", "JavaScript", "Python", "SQL"] },
    { label: "Frontend", items: ["React", "Next.js", "Tailwind CSS", "Motion"] },
    { label: "Backend", items: ["Node.js", "Bun", "REST", "GraphQL"] },
    { label: "Tooling", items: ["Git", "GitHub Actions", "Vitest", "Playwright"] },
  ],
};
