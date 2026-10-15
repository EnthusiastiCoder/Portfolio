import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";
import { getAllProjects, getFeaturedProjects, getProjectBySlug } from "@/lib/projects";

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CONTENT_DIR = path.resolve(process.cwd(), "src/content/projects");
