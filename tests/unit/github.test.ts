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

// 2 normal repos (10 and 3 stars), a fork (100 stars), an archived repo (7 stars),
// a repo with null language, and repos sharing a language (TypeScript).
const reposFixture: RepoFixture[] = [
  makeRepo({
    name: "alpha",
    stargazers_count: 10,
    language: "TypeScript",
    pushed_at: "2026-10-01T00:00:00Z",
  }),
  makeRepo({
    name: "beta",
    stargazers_count: 3,
    language: "Python",
    pushed_at: "2026-09-01T00:00:00Z",
  }),
  makeRepo({
    name: "forked",
    stargazers_count: 100,
    language: "TypeScript",
    fork: true,
    pushed_at: "2026-11-10T00:00:00Z",
  }),
  makeRepo({
    name: "old",
    stargazers_count: 7,
    language: "Go",
    archived: true,
    pushed_at: "2020-01-01T00:00:00Z",
  }),
  makeRepo({
    name: "nolang",
    description: null,
    stargazers_count: 3,
    language: null,
    pushed_at: "2026-11-01T00:00:00Z",
  }),
  makeRepo({
    name: "gamma",
    stargazers_count: 0,
    language: "TypeScript",
    pushed_at: "2026-08-01T00:00:00Z",
  }),
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function routedFetch(
  userBody: unknown = userFixture,
  reposBody: unknown = reposFixture,
  status = 200,
) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/repos")) return jsonResponse(reposBody, status);
    return jsonResponse(userBody, status);
  });
}

type CallRecorder = { mock: { calls: unknown[][] } };

function callUrls(fetchImpl: CallRecorder): string[] {
  return fetchImpl.mock.calls.map(([input]) =>
    String(input instanceof Request ? input.url : input),
  );
}

function callInits(fetchImpl: CallRecorder): RequestInit[] {
  return fetchImpl.mock.calls.map(([, init]) => (init ?? {}) as RequestInit);
}
