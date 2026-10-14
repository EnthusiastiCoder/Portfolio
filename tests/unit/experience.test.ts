import { describe, it, expect } from "vitest";
import { sortExperience } from "@/lib/experience";
import { experience, type ExperienceItem } from "@/data/experience";

function item(id: string, start: string, end: string | null): ExperienceItem {
  return {
    id,
    role: "Engineer",
    company: `Company ${id}`,
    start,
    end,
    summary: "Placeholder summary.",
    highlights: ["Did a thing"],
    tech: ["TypeScript"],
  };
}
