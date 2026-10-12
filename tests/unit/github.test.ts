import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { getGitHubStats, toGitHubStats } from "@/lib/stats/github";
import { REVALIDATE_SECONDS } from "@/lib/stats/constants";
import githubSnapshot from "@/data/snapshots/github.json";

const USER_URL = "https://api.github.com/users/EnthusiastiCoder";
