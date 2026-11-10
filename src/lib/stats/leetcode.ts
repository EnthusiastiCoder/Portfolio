import { z } from "zod";
import { siteConfig } from "@/config/site";
import snapshot from "@/data/snapshots/leetcode.json";
import { REVALIDATE_SECONDS } from "./constants";
import type { DifficultyCounts, LeetCodeStats, Sourced } from "./types";

export const LEETCODE_ENDPOINT = "https://leetcode.com/graphql";
