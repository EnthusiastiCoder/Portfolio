import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

describe("plans/ stays private", () => {
  // Case 91 (WS0)
  it(".gitignore ignores the plans/ folder", () => {
    const lines = readFileSync(path.resolve(root, ".gitignore"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim());
    expect(lines.some((l) => l === "plans/" || l === "/plans/")).toBe(true);
  });

  it("git tracks nothing under plans/", () => {
    const out = execFileSync("git", ["ls-files", "plans"], { cwd: root, encoding: "utf8" });
    expect(out).toBe("");
  });
});
