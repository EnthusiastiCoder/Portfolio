#!/usr/bin/env node
// Manually refreshes src/data/snapshots/github.json from the live API.
// Run with `pnpm snapshot:refresh`. Never run in tests or CI.
// Mirrors the transforms in src/lib/stats/github.ts.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotDir = path.join(root, "src/data/snapshots");

async function readHandles() {
  const site = await readFile(path.join(root, "src/config/site.ts"), "utf8");
  const github = /github:\s*"([^"]+)"/.exec(site)?.[1];
  if (!github) throw new Error("Could not read handles from src/config/site.ts");
  return { github };
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

async function writeSnapshot(name, data) {
  const file = path.join(snapshotDir, `${name}.json`);
  const body = { fetchedAt: new Date().toISOString(), data };
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, file)}`);
}

async function main() {
  const handles = await readHandles();
  let failed = false;
  for (const [name, run] of [["github", () => fetchGitHub(handles.github)]]) {
    try {
      await writeSnapshot(name, await run());
    } catch (error) {
      failed = true;
      console.error(`Skipped ${name} snapshot: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

await main();
