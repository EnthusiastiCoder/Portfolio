import { siteConfig } from "@/config/site";
import { getGitHubStats } from "@/lib/stats/github";
import { getLeetCodeStats } from "@/lib/stats/leetcode";

export const revalidate = 21600;

export default async function Home() {
  const [github, leetcode] = await Promise.all([getGitHubStats(), getLeetCodeStats()]);

  return (
    <main id="main" className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">{siteConfig.name}</h1>
      <div data-testid="github-stats">
        <p>Public repos: {github.data.publicRepos}</p>
        <p>Total stars: {github.data.totalStars}</p>
      </div>
      <div data-testid="leetcode-stats">
        <p>Problems solved: {leetcode.data.solved.all}</p>
      </div>
    </main>
  );
}
