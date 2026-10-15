import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";
import { getAllProjects, getFeaturedProjects, getProjectBySlug } from "@/lib/projects";

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CONTENT_DIR = path.resolve(process.cwd(), "src/content/projects");

describe("projects data", () => {
  // Case 31
  it("has at least 3 valid projects, at least 2 featured", () => {
    expect(projects.length).toBeGreaterThanOrEqual(3);
    expect(projects.filter((p) => p.featured).length).toBeGreaterThanOrEqual(2);
