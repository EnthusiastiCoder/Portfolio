import ExternalLink from "@/components/ExternalLink";
import type { GitHubRepoSummary } from "@/lib/stats/types";

const MAX_REPOS = 4;
/** Scratch and utility repos that are not worth showcasing. */
const HIDDEN = [/^testing/i, /^keepalive$/i];

export function showcaseRepos(repos: GitHubRepoSummary[]): GitHubRepoSummary[] {
  return repos.filter((repo) => !HIDDEN.some((re) => re.test(repo.name))).slice(0, MAX_REPOS);
}

export default function FeaturedRepos({ repos }: { repos: GitHubRepoSummary[] }) {
  const shown = showcaseRepos(repos);
  if (shown.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="prompt text-sm" aria-hidden="true">
        gh repo list
      </p>
      <h3 className="text-accent mt-1 text-lg font-bold">From GitHub</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {shown.map((repo) => (
          <li key={repo.name} className="term p-4">
            <ExternalLink href={repo.url} className="font-bold break-all">
              {repo.name}
            </ExternalLink>
            <p className="text-muted mt-1 text-sm">{repo.description ?? "No description yet."}</p>
            <p className="text-muted mt-2 text-xs">
              {repo.language ?? "Mixed"} · {repo.stars} {repo.stars === 1 ? "star" : "stars"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
