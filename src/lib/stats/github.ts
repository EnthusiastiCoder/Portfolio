import { z } from "zod";
import { siteConfig } from "@/config/site";
import snapshot from "@/data/snapshots/github.json";
import { REVALIDATE_SECONDS } from "./constants";
import type { GitHubRepoSummary, GitHubStats, Sourced } from "./types";

const GITHUB_API = "https://api.github.com";
const MAX_LANGUAGES = 5;
const MAX_FEATURED = 6;

const userSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  avatar_url: z.string(),
  html_url: z.string(),
  followers: z.number().int().nonnegative(),
  public_repos: z.number().int().nonnegative(),
});

const repoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  html_url: z.string(),
  stargazers_count: z.number().int().nonnegative(),
  language: z.string().nullable(),
  fork: z.boolean(),
  archived: z.boolean(),
  pushed_at: z.string(),
});

const reposSchema = z.array(repoSchema);
