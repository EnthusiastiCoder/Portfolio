import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getLeetCodeStats,
  toLeetCodeStats,
  LEETCODE_ENDPOINT,
  LEETCODE_QUERY,
} from "@/lib/stats/leetcode";
import leetcodeSnapshot from "@/data/snapshots/leetcode.json";
import githubSnapshot from "@/data/snapshots/github.json";

function validResponse() {
  return {
    data: {
      allQuestionsCount: [
        { difficulty: "All", count: 3300 },
        { difficulty: "Easy", count: 850 },
        { difficulty: "Medium", count: 1750 },
        { difficulty: "Hard", count: 700 },
      ],
      matchedUser: {
        username: "EnthusiastiCoder",
        profile: { ranking: 123456 },
        submitStatsGlobal: {
          acSubmissionNum: [
            { difficulty: "All", count: 300, submissions: 700 },
            { difficulty: "Easy", count: 120, submissions: 250 },
            { difficulty: "Medium", count: 150, submissions: 380 },
            { difficulty: "Hard", count: 30, submissions: 70 },
          ],
        },
      },
      userContestRanking: {
        rating: 1523.67,
        attendedContestsCount: 12,
        topPercentage: 35.5,
      },
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const expectedSnapshotResult = {
  data: leetcodeSnapshot.data,
  source: "snapshot",
  fetchedAt: leetcodeSnapshot.fetchedAt,
};

beforeEach(() => {
  vi.stubEnv("STATS_SOURCE", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("toLeetCodeStats", () => {
  // Case 17
  it("maps solved counts, totals, ranking, username and profileUrl", () => {
    const stats = toLeetCodeStats(validResponse());
    expect(stats.username).toBe("EnthusiastiCoder");
    expect(stats.profileUrl).toBe("https://leetcode.com/u/EnthusiastiCoder/");
    expect(stats.ranking).toBe(123456);
    expect(stats.solved).toEqual({ all: 300, easy: 120, medium: 150, hard: 30 });
    expect(stats.totals).toEqual({ all: 3300, easy: 850, medium: 1750, hard: 700 });
  });

  // Case 18
  it("maps contest data with a rounded rating", () => {
    const stats = toLeetCodeStats(validResponse());
    expect(stats.contest).toEqual({ rating: 1524, attended: 12, topPercentage: 35.5 });
  });

  it("maps userContestRanking: null to contest: null", () => {
    const json = validResponse();
    (json.data as { userContestRanking: unknown }).userContestRanking = null;
    expect(toLeetCodeStats(json).contest).toBeNull();
  });

  // Case 19
  it("maps a missing difficulty entry to 0", () => {
    const json = validResponse();
    json.data.matchedUser.submitStatsGlobal.acSubmissionNum =
      json.data.matchedUser.submitStatsGlobal.acSubmissionNum.filter(
        (e) => e.difficulty !== "Hard",
      );
    const stats = toLeetCodeStats(json);
    expect(stats.solved).toEqual({ all: 300, easy: 120, medium: 150, hard: 0 });
  });

  // Case 20
  it("throws when matchedUser is null", () => {
    const json = validResponse();
    (json.data as { matchedUser: unknown }).matchedUser = null;
    expect(() => toLeetCodeStats(json)).toThrow();
  });

  it("throws when errors is a non-empty array", () => {
    const json = {
      ...validResponse(),
      errors: [{ message: "That user does not exist." }],
    };
    expect(() => toLeetCodeStats(json)).toThrow();
  });

  it("throws on an invalid shape", () => {
    expect(() => toLeetCodeStats({ nope: true })).toThrow();
    expect(() => toLeetCodeStats(null)).toThrow();
  });
});

describe("getLeetCodeStats", () => {
  // Case 21
  it("POSTs the GraphQL query once and returns live data", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(validResponse()),
    );
    const result = await getLeetCodeStats({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(LEETCODE_ENDPOINT).toBe("https://leetcode.com/graphql");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [input, init] = fetchImpl.mock.calls[0];
    expect(String(input)).toBe("https://leetcode.com/graphql");
    expect(init?.method).toBe("POST");

    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("referer")).toBe("https://leetcode.com/u/EnthusiastiCoder/");

    expect(JSON.parse(String(init?.body))).toEqual({
      query: LEETCODE_QUERY,
      variables: { username: "EnthusiastiCoder" },
    });
    expect((init as RequestInit & { next?: { revalidate?: number } }).next).toEqual({
      revalidate: 21600,
    });

    expect(result.source).toBe("live");
    expect(result.data).toEqual(toLeetCodeStats(validResponse()));
    expect(new Date(result.fetchedAt).toISOString()).toBe(result.fetchedAt);
  });

  it("LEETCODE_QUERY requests the fields used by the transform", () => {
    for (const field of [
      "allQuestionsCount",
      "matchedUser(username: $username)",
      "acSubmissionNum",
      "ranking",
      "userContestRanking(username: $username)",
      "attendedContestsCount",
      "topPercentage",
    ]) {
      expect(LEETCODE_QUERY).toContain(field);
    }
  });

  // Case 22
  it.each([403, 429])("falls back to the snapshot on HTTP %i", async (status) => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "blocked" }, status));
    const result = await getLeetCodeStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual(expectedSnapshotResult);
  });

  it("falls back to the snapshot when fetch rejects", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await getLeetCodeStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual(expectedSnapshotResult);
  });

  it("falls back to the snapshot when matchedUser is null", async () => {
    const json = validResponse();
    (json.data as { matchedUser: unknown }).matchedUser = null;
    const fetchImpl = vi.fn(async () => jsonResponse(json));
    const result = await getLeetCodeStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual(expectedSnapshotResult);
  });

  it("falls back to the snapshot when GraphQL returns errors", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: null, errors: [{ message: "rate limited" }] }),
    );
    const result = await getLeetCodeStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual(expectedSnapshotResult);
  });

  // Case 23
  it("returns the snapshot without fetching when STATS_SOURCE=snapshot", async () => {
    vi.stubEnv("STATS_SOURCE", "snapshot");
    const fetchImpl = vi.fn(async () => jsonResponse(validResponse()));
    const result = await getLeetCodeStats({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual(expectedSnapshotResult);
  });
});
