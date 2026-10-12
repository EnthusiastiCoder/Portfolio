import { describe, it, expect } from "vitest";
import { siteConfig } from "@/config/site";

describe("siteConfig", () => {
  // Case 1
  it("defines the GitHub and LeetCode handles", () => {
    expect(siteConfig.handles.github).toBe("EnthusiastiCoder");
    expect(siteConfig.handles.leetcode).toBe("EnthusiastiCoder");
  });

  // Case 2
  it("derives profile links from the handles", () => {
    expect(siteConfig.links.github).toBe("https://github.com/EnthusiastiCoder");
    expect(siteConfig.links.leetcode).toBe(
      "https://leetcode.com/u/EnthusiastiCoder/",
    );
  });

  // Case 3
  it("has an absolute https url without trailing slash, resume path and a valid email", () => {
    expect(siteConfig.url).toMatch(/^https:\/\/[^\s/]+(\/[^\s]*)?$/);
    expect(siteConfig.url.endsWith("/")).toBe(false);
    expect(() => new URL(siteConfig.url)).not.toThrow();
    expect(siteConfig.resumePath).toBe("/resume.pdf");
    expect(siteConfig.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
