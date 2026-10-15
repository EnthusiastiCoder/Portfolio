import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { projects } from "@/data/projects";
import { getAllProjects, getFeaturedProjects, getProjectBySlug } from "@/lib/projects";
