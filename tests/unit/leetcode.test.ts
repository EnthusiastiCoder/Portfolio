import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getLeetCodeStats,
  toLeetCodeStats,
  LEETCODE_ENDPOINT,
  LEETCODE_QUERY,
} from "@/lib/stats/leetcode";
import leetcodeSnapshot from "@/data/snapshots/leetcode.json";
import githubSnapshot from "@/data/snapshots/github.json";
