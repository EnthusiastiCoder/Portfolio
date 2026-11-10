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

/** Validates raw GitHub API payloads and derives the site stats. Throws on invalid input. */
export function toGitHubStats(user: unknown, repos: unknown): GitHubStats {
  const u = userSchema.parse(user);
  const owned = reposSchema.parse(repos).filter((repo) => !repo.fork);

  return {
    login: u.login,
    name: u.name,
    avatarUrl: u.avatar_url,
    profileUrl: u.html_url,
    followers: u.followers,
    publicRepos: u.public_repos,
    totalStars: owned.reduce((sum, repo) => sum + repo.stargazers_count, 0),
    topLanguages: topLanguages(owned),
    featuredRepos: featuredRepos(owned),
  };
}

export interface GetGitHubStatsOptions {
  fetchImpl?: typeof fetch;
  token?: string;
}

type NextRequestInit = RequestInit & { next?: { revalidate: number } };

function fromSnapshot(): Sourced<GitHubStats> {
  return { data: snapshot.data, source: "snapshot", fetchedAt: snapshot.fetchedAt };
}

async function getJson(fetchImpl: typeof fetch, url: string, init: NextRequestInit) {
  const res = await fetchImpl(url, init);
  if (!res.ok) throw new Error(`GitHub API responded ${res.status} for ${url}`);
  return (await res.json()) as unknown;
}

/** Live GitHub stats, falling back to the committed snapshot on any failure. Never throws. */
export async function getGitHubStats(
  opts: GetGitHubStatsOptions = {},
): Promise<Sourced<GitHubStats>> {
  if (process.env.STATS_SOURCE === "snapshot") return fromSnapshot();
