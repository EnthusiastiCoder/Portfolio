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

const fixture: ExperienceItem[] = [
  item("a", "2020-01", "2021-05"),
  item("b", "2022-03", null),
  item("c", "2019-01", "2021-05"),
  item("d", "2021-06", "2023-02"),
  item("e", "2023-01", null),
];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

describe("sortExperience", () => {
  // Case 28
  it("puts current roles first, then end desc, ties by start desc", () => {
    expect(sortExperience(fixture).map((x) => x.id)).toEqual(["e", "b", "d", "a", "c"]);
  });

  // Case 29
  it("returns a new array and does not mutate the input", () => {
    const input = [...fixture];
    const result = sortExperience(input);
    expect(result).not.toBe(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
