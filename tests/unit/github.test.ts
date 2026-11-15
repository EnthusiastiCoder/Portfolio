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

let warnSpy: MockInstance;

beforeEach(() => {
  vi.stubEnv("STATS_SOURCE", "");
  vi.stubEnv("GITHUB_TOKEN", "");
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("toGitHubStats", () => {
  // Case 4
  it("maps user fields", () => {
    const stats = toGitHubStats(userFixture, reposFixture);
    expect(stats.login).toBe("EnthusiastiCoder");
    expect(stats.name).toBe("Arpan");
    expect(stats.avatarUrl).toBe("https://avatars.githubusercontent.com/u/123?v=4");
    expect(stats.profileUrl).toBe("https://github.com/EnthusiastiCoder");
    expect(stats.followers).toBe(42);
    expect(stats.publicRepos).toBe(12);
  });

  // Case 5
  it("sums stars over non-fork repos, including archived ones", () => {
    const stats = toGitHubStats(userFixture, reposFixture);
    // alpha 10 + beta 3 + old (archived) 7 + nolang 3 + gamma 0; fork (100) excluded
    expect(stats.totalStars).toBe(23);
  });

  // Case 6
  it("counts top languages over non-fork repos, skipping null, sorted count desc then name asc", () => {
    const stats = toGitHubStats(userFixture, reposFixture);
    expect(stats.topLanguages).toEqual([
      { name: "TypeScript", count: 2 },
      { name: "Go", count: 1 },
      { name: "Python", count: 1 },
    ]);
  });

  it("caps top languages at 5 when there are 6 languages", () => {
    const repos = [
      makeRepo({ name: "r1", language: "Rust" }),
      makeRepo({ name: "r2", language: "Rust" }),
      makeRepo({ name: "r3", language: "Rust" }),
      makeRepo({ name: "t1", language: "TypeScript" }),
      makeRepo({ name: "t2", language: "TypeScript" }),
      makeRepo({ name: "g1", language: "Go" }),
      makeRepo({ name: "g2", language: "Go" }),
      makeRepo({ name: "z1", language: "Zig" }),
      makeRepo({ name: "c1", language: "C" }),
      makeRepo({ name: "a1", language: "Ada" }),
      makeRepo({ name: "f1", language: "Haskell", fork: true }),
      makeRepo({ name: "f2", language: "Haskell", fork: true }),
      makeRepo({ name: "f3", language: "Haskell", fork: true }),
      makeRepo({ name: "f4", language: "Haskell", fork: true }),
    ];
    const stats = toGitHubStats(userFixture, repos);
    expect(stats.topLanguages).toEqual([
      { name: "Rust", count: 3 },
      { name: "Go", count: 2 },
      { name: "TypeScript", count: 2 },
      { name: "Ada", count: 1 },
      { name: "C", count: 1 },
    ]);
  });

  it("never features hidden junk repos", () => {
    const repos = [
      makeRepo({ name: "TestingShit", stargazers_count: 99 }),
      makeRepo({ name: "testingfrit" }),
      makeRepo({ name: "real" }),
    ];
    const stats = toGitHubStats(userFixture, repos);
    expect(stats.featuredRepos.map((r) => r.name)).toEqual(["real"]);
  });

  // Case 7
  it("selects featured repos: non-fork, non-archived, stars desc then updatedAt desc", () => {
    const stats = toGitHubStats(userFixture, reposFixture);
    expect(stats.featuredRepos).toEqual([
      {
        name: "alpha",
        description: "alpha description",
        url: "https://github.com/EnthusiastiCoder/alpha",
        stars: 10,
        language: "TypeScript",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        name: "nolang",
        description: null,
        url: "https://github.com/EnthusiastiCoder/nolang",
        stars: 3,
        language: null,
        updatedAt: "2026-11-01T00:00:00Z",
      },
      {
        name: "beta",
        description: "beta description",
        url: "https://github.com/EnthusiastiCoder/beta",
        stars: 3,
        language: "Python",
        updatedAt: "2026-09-01T00:00:00Z",
      },
      {
        name: "gamma",
        description: "gamma description",
        url: "https://github.com/EnthusiastiCoder/gamma",
        stars: 0,
        language: "TypeScript",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    ]);
  });

  it("caps featured repos at 6", () => {
    const repos = Array.from({ length: 8 }, (_, i) =>
      makeRepo({
        name: `repo-${i}`,
        stargazers_count: i,
        pushed_at: `2026-0${i + 1}-01T00:00:00Z`,
      }),
    );
    const stats = toGitHubStats(userFixture, repos);
    expect(stats.featuredRepos).toHaveLength(6);
    expect(stats.featuredRepos.map((r) => r.name)).toEqual([
      "repo-7",
      "repo-6",
      "repo-5",
      "repo-4",
      "repo-3",
      "repo-2",
    ]);
  });

  // Case 8
  it("throws on invalid input", () => {
    const { login: _login, ...userWithoutLogin } = userFixture;
    expect(() => toGitHubStats(userWithoutLogin, reposFixture)).toThrow();
    expect(() => toGitHubStats(userFixture, { not: "an array" })).toThrow();
    expect(() => toGitHubStats(null, reposFixture)).toThrow();
  });
});

describe("getGitHubStats", () => {
  // Case 9
  it("fetches user and repos and returns live data", async () => {
    const fetchImpl = routedFetch();
    const before = Date.now();
    const result = await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const urls = callUrls(fetchImpl);
    expect(urls).toContain(USER_URL);
    const reposUrl = urls.find((u) => u.includes("/users/EnthusiastiCoder/repos"));
    expect(reposUrl).toBeDefined();
    expect(reposUrl).toContain("per_page=100");

    expect(result.source).toBe("live");
    expect(result.data).toEqual(toGitHubStats(userFixture, reposFixture));
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(new Date(result.fetchedAt).toISOString()).toBe(result.fetchedAt);
    expect(new Date(result.fetchedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  // Case 10
  it("passes next.revalidate and GitHub headers on each call", async () => {
    const fetchImpl = routedFetch();
    await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const inits = callInits(fetchImpl);
    expect(inits.length).toBeGreaterThanOrEqual(2);
    for (const init of inits) {
      expect((init as RequestInit & { next?: { revalidate?: number } }).next).toEqual({
        revalidate: 21600,
      });
      const headers = new Headers(init.headers);
      expect(headers.get("accept")).toBe("application/vnd.github+json");
      expect(headers.get("x-github-api-version")).toBe("2022-11-28");
    }
  });

  // Case 11
  it("sends Authorization only when a token is set", async () => {
    const withToken = routedFetch();
    await getGitHubStats({ fetchImpl: withToken as unknown as typeof fetch, token: "abc" });
    for (const init of callInits(withToken)) {
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer abc");
    }

    const withoutToken = routedFetch();
    await getGitHubStats({ fetchImpl: withoutToken as unknown as typeof fetch });
    expect(withoutToken).toHaveBeenCalled();
    for (const init of callInits(withoutToken)) {
      expect(new Headers(init.headers).has("authorization")).toBe(false);
    }
  });

  it("uses GITHUB_TOKEN from env when no token option is given", async () => {
    vi.stubEnv("GITHUB_TOKEN", "envtoken");
    const fetchImpl = routedFetch();
    await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalled();
    for (const init of callInits(fetchImpl)) {
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer envtoken");
    }
  });

  // Case 12
  it("falls back to the snapshot on a non-2xx response", async () => {
    const fetchImpl = routedFetch({ message: "API rate limit exceeded" }, [], 403);
    const result = await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({
      data: githubSnapshot.data,
      source: "snapshot",
      fetchedAt: githubSnapshot.fetchedAt,
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  // Case 13
  it("falls back to the snapshot when fetch rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({
      data: githubSnapshot.data,
      source: "snapshot",
      fetchedAt: githubSnapshot.fetchedAt,
    });
  });

  // Case 14
  it("falls back to the snapshot on a malformed body", async () => {
    const fetchImpl = routedFetch({ unexpected: true }, { also: "wrong" }, 200);
    const result = await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({
      data: githubSnapshot.data,
      source: "snapshot",
      fetchedAt: githubSnapshot.fetchedAt,
    });
  });

  // Case 15
  it("returns the snapshot without fetching when STATS_SOURCE=snapshot", async () => {
    vi.stubEnv("STATS_SOURCE", "snapshot");
    const fetchImpl = routedFetch();
    const result = await getGitHubStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: githubSnapshot.data,
      source: "snapshot",
      fetchedAt: githubSnapshot.fetchedAt,
    });
  });
});

describe("REVALIDATE_SECONDS", () => {
  // Case 16
  it("equals 21600 (6 hours)", () => {
    expect(REVALIDATE_SECONDS).toBe(21600);
  });
});
