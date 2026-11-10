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

type Repo = z.infer<typeof repoSchema>;

function topLanguages(repos: Repo[]): GitHubStats["topLanguages"] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language === null) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .slice(0, MAX_LANGUAGES);
}

function featuredRepos(repos: Repo[]): GitHubRepoSummary[] {
  return repos
    .filter((repo) => !repo.archived)
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        Date.parse(b.pushed_at) - Date.parse(a.pushed_at),
    )
    .slice(0, MAX_FEATURED)
    .map((repo) => ({
      name: repo.name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      updatedAt: repo.pushed_at,
    }));
}
