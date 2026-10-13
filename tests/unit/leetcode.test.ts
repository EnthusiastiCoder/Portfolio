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
