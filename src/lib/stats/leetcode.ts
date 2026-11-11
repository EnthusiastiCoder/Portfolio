import { z } from "zod";
import { siteConfig } from "@/config/site";
import snapshot from "@/data/snapshots/leetcode.json";
import { REVALIDATE_SECONDS } from "./constants";
import type { DifficultyCounts, LeetCodeStats, Sourced } from "./types";

export const LEETCODE_ENDPOINT = "https://leetcode.com/graphql";

export const LEETCODE_QUERY = `query userProfile($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    username
    profile { ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
  }
  userContestRanking(username: $username) { rating attendedContestsCount topPercentage }
}`;

const difficultyCountSchema = z.object({
  difficulty: z.string(),
  count: z.number().int().nonnegative(),
});

const responseSchema = z.object({
  errors: z.array(z.unknown()).optional(),
  data: z
    .object({
      allQuestionsCount: z.array(difficultyCountSchema),
      matchedUser: z
        .object({
          username: z.string(),
          profile: z.object({ ranking: z.number().int().nonnegative().nullable() }),
          submitStatsGlobal: z.object({ acSubmissionNum: z.array(difficultyCountSchema) }),
        })
        .nullable(),
      userContestRanking: z
        .object({
          rating: z.number().nonnegative(),
          attendedContestsCount: z.number().int().nonnegative(),
          topPercentage: z.number().nonnegative().nullable(),
        })
        .nullable(),
    })
    .nullable(),
});

type DifficultyCount = z.infer<typeof difficultyCountSchema>;

function toCounts(entries: DifficultyCount[]): DifficultyCounts {
  const find = (difficulty: string) =>
    entries.find((e) => e.difficulty.toLowerCase() === difficulty)?.count ?? 0;
  return { all: find("all"), easy: find("easy"), medium: find("medium"), hard: find("hard") };
}

/** Validates a LeetCode GraphQL response and maps it to site stats. Throws on errors or bad shape. */
export function toLeetCodeStats(json: unknown): LeetCodeStats {
  const parsed = responseSchema.parse(json);
  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(`LeetCode GraphQL returned ${parsed.errors.length} error(s)`);
  }
  if (!parsed.data) throw new Error("LeetCode GraphQL returned no data");
  const { allQuestionsCount, matchedUser, userContestRanking } = parsed.data;
  if (!matchedUser) throw new Error("LeetCode user not found");

  return {
    username: matchedUser.username,
    profileUrl: `https://leetcode.com/u/${matchedUser.username}/`,
    ranking: matchedUser.profile.ranking,
    solved: toCounts(matchedUser.submitStatsGlobal.acSubmissionNum),
    totals: toCounts(allQuestionsCount),
    contest: userContestRanking
      ? {
          rating: Math.round(userContestRanking.rating),
          attended: userContestRanking.attendedContestsCount,
          topPercentage: userContestRanking.topPercentage,
        }
      : null,
  };
}

export interface GetLeetCodeStatsOptions {
  fetchImpl?: typeof fetch;
}

type NextRequestInit = RequestInit & { next?: { revalidate: number } };

function fromSnapshot(): Sourced<LeetCodeStats> {
  return { data: snapshot.data, source: "snapshot", fetchedAt: snapshot.fetchedAt };
}

/** Live LeetCode stats, falling back to the committed snapshot on any failure. Never throws. */
export async function getLeetCodeStats(
  opts: GetLeetCodeStatsOptions = {},
): Promise<Sourced<LeetCodeStats>> {
  if (process.env.STATS_SOURCE === "snapshot") return fromSnapshot();

  const fetchImpl = opts.fetchImpl ?? fetch;
  const username = siteConfig.handles.leetcode;
  const init: NextRequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://leetcode.com/u/${username}/`,
    },
    body: JSON.stringify({ query: LEETCODE_QUERY, variables: { username } }),
    next: { revalidate: REVALIDATE_SECONDS },
  };

  try {
    const res = await fetchImpl(LEETCODE_ENDPOINT, init);
    if (!res.ok) throw new Error(`LeetCode GraphQL responded ${res.status}`);
    const data = toLeetCodeStats(await res.json());
    return { data, source: "live", fetchedAt: new Date().toISOString() };
  } catch (error) {
    console.warn("[stats] LeetCode fetch failed, using snapshot:", error);
    return fromSnapshot();
  }
}
