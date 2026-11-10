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
