import ExternalLink from "@/components/ExternalLink";
import { formatCompactNumber } from "@/lib/format";
import { formatAsOf } from "@/lib/stats/as-of";
import type { GitHubStats, Sourced } from "@/lib/stats/types";

export default function GitHubStatsCard({ stats }: { stats: Sourced<GitHubStats> }) {
  const { data } = stats;
  const rows: [string, string][] = [
    ["Public repos", formatCompactNumber(data.publicRepos)],
    ["Total stars", formatCompactNumber(data.totalStars)],
    ["Followers", formatCompactNumber(data.followers)],
  ];
  return (
    <article data-testid="github-stats" className="term flex flex-col" aria-labelledby="gh-title">
      <div className="term-bar" aria-hidden="true">
        github --stats
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 id="gh-title" className="text-accent text-lg font-bold">
          GitHub
        </h3>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted text-xs">{label}</dt>
              <dd className="text-ink text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        {data.topLanguages.length > 0 && (
          <div className="mt-4">
            <p className="text-muted text-xs">Top languages</p>
            <ul className="mt-1 flex flex-wrap gap-2 text-sm">
              {data.topLanguages.map((lang) => (
                <li key={lang.name} className="border-accent-dim/50 rounded border px-2 py-0.5">
                  {lang.name}
                  <span className="text-muted"> ×{lang.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 pt-4 text-sm">
          <ExternalLink href={data.profileUrl}>@{data.login} on GitHub</ExternalLink>
          {stats.source === "snapshot" && (
            <p className="text-muted text-xs">Stats as of {formatAsOf(stats.fetchedAt)}</p>
          )}
        </div>
      </div>
    </article>
  );
}
