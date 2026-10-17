import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const NOTICE = "© Arpan Mandal. All Rights Reserved.";
const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.resolve(root, rel), "utf8");
}

describe("rights notice", () => {
  // Case 90a
  it("has a root COPYRIGHT file whose first line is the notice", () => {
    expect(existsSync(path.resolve(root, "COPYRIGHT"))).toBe(true);
    const firstLine = read("COPYRIGHT").replace(/^﻿/, "").split(/\r?\n/)[0];
    expect(firstLine).toBe(NOTICE);
  });

  // Case 90b
  it("has no LICENSE or LICENCE file at the root", () => {
    const licences = readdirSync(root).filter((name) => /^(LICENSE|LICENCE)(\..*)?$/i.test(name));
    expect(licences).toEqual([]);
  });

  // Case 90c (WS2)
  it("README.md contains the notice", () => {
    expect(read("README.md")).toContain(NOTICE);
  });

  // Case 90d
  it("package.json is UNLICENSED and private", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.license).toBe("UNLICENSED");
    expect(pkg.private).toBe(true);
  });
});
