#!/usr/bin/env node
// Manually refreshes src/data/snapshots/{github,leetcode}.json from the live APIs.
// Run with `pnpm snapshot:refresh`. Never run in tests or CI.
// Mirrors the transforms in src/lib/stats/{github,leetcode}.ts.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotDir = path.join(root, "src/data/snapshots");

async function readHandles() {
  const site = await readFile(path.join(root, "src/config/site.ts"), "utf8");
  const github = /github:\s*"([^"]+)"/.exec(site)?.[1];
  const leetcode = /leetcode:\s*"([^"]+)"/.exec(site)?.[1];
  if (!github || !leetcode) throw new Error("Could not read handles from src/config/site.ts");
  return { github, leetcode };
}

const byNameAsc = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

async function fetchGitHub(handle) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const get = async (url) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GitHub API responded ${res.status} for ${url}`);
    return res.json();
  };
  const userUrl = `https://api.github.com/users/${handle}`;
  const [user, repos] = await Promise.all([
    get(userUrl),
    get(`${userUrl}/repos?per_page=100&type=owner&sort=pushed`),
  ]);
  const owned = repos.filter((r) => !r.fork);
  const counts = new Map();
  for (const r of owned) {
    if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  return {
    login: user.login,
    name: user.name ?? null,
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url,
    followers: user.followers,
    publicRepos: user.public_repos,
    totalStars: owned.reduce((sum, r) => sum + r.stargazers_count, 0),
    topLanguages: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || byNameAsc(a, b))
      .slice(0, 5),
    featuredRepos: owned
      .filter((r) => !r.archived)
      .sort(
        (a, b) =>
          b.stargazers_count - a.stargazers_count ||
          Date.parse(b.pushed_at) - Date.parse(a.pushed_at),
      )
      .slice(0, 6)
      .map((r) => ({
        name: r.name,
        description: r.description ?? null,
        url: r.html_url,
        stars: r.stargazers_count,
        language: r.language ?? null,
        updatedAt: r.pushed_at,
      })),
  };
}

const LEETCODE_QUERY = `query userProfile($username: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $username) {
    username
    profile { ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
  }
  userContestRanking(username: $username) { rating attendedContestsCount topPercentage }
}`;
