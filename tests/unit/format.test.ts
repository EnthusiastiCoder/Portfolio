import { describe, it, expect } from "vitest";
import { formatMonth, formatDateRange, formatCompactNumber } from "@/lib/format";

describe("formatMonth", () => {
  // Case 25
  it("formats YYYY-MM as short month and year, timezone-independent", () => {
    expect(formatMonth("2023-01")).toBe("Jan 2023");
    expect(formatMonth("2023-03")).toBe("Mar 2023");
    expect(formatMonth("2024-12")).toBe("Dec 2024");
  });
});

describe("formatDateRange", () => {
  // Case 26
  it("formats an open-ended range with Present and an en dash", () => {
    expect(formatDateRange("2023-01", null)).toBe("Jan 2023 – Present");
  });

  it("formats a closed range with an en dash", () => {
    expect(formatDateRange("2021-06", "2022-12")).toBe("Jun 2021 – Dec 2022");
  });
});

describe("formatCompactNumber", () => {
  // Case 27
  it("formats numbers in compact en-US notation with one fraction digit", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(1234)).toBe("1.2K");
    expect(formatCompactNumber(1500000)).toBe("1.5M");
  });
});
