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
