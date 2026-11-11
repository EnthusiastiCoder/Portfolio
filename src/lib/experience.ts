import type { ExperienceItem } from "@/data/experience";

function compareDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/** Current roles first, then by end month desc, ties by start month desc. Returns a new array. */
export function sortExperience(items: readonly ExperienceItem[]): ExperienceItem[] {
  return [...items].sort((a, b) => {
    if (a.end === null && b.end !== null) return -1;
    if (a.end !== null && b.end === null) return 1;
    if (a.end !== null && b.end !== null && a.end !== b.end) return compareDesc(a.end, b.end);
    return compareDesc(a.start, b.start);
  });
}
