import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { getGitHubStats, toGitHubStats } from "@/lib/stats/github";
import { REVALIDATE_SECONDS } from "@/lib/stats/constants";
import githubSnapshot from "@/data/snapshots/github.json";

const USER_URL = "https://api.github.com/users/EnthusiastiCoder";

interface RepoFixture {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
}

function makeRepo(overrides: Partial<RepoFixture> & { name: string }): RepoFixture {
  return {
    description: `${overrides.name} description`,
    html_url: `https://github.com/EnthusiastiCoder/${overrides.name}`,
    stargazers_count: 0,
    language: "TypeScript",
    fork: false,
    archived: false,
    pushed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const userFixture = {
  login: "EnthusiastiCoder",
  id: 123,
  name: "Arpan",
  avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
  html_url: "https://github.com/EnthusiastiCoder",
  followers: 42,
  following: 5,
  public_repos: 12,
};
