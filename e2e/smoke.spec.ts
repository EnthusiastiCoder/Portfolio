import { test, expect } from "@playwright/test";
import { siteConfig } from "../src/config/site";
import { projects } from "../src/data/projects";
import githubSnapshot from "../src/data/snapshots/github.json";
import leetcodeSnapshot from "../src/data/snapshots/leetcode.json";

// Same rule as src/lib/format.ts formatCompactNumber.
const compact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
