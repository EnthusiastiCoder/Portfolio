import ExternalLink from "@/components/ExternalLink";
import { formatCompactNumber } from "@/lib/format";
import { formatAsOf } from "@/lib/stats/as-of";
import type { LeetCodeStats, Sourced } from "@/lib/stats/types";

const LEVELS = ["easy", "medium", "hard"] as const;

export default function LeetCodeStatsCard({ stats }: { stats: Sourced<LeetCodeStats> }) {
  const { data } = stats;
  return (
    <article data-testid="leetcode-stats" className="term flex flex-col" aria-labelledby="lc-title">
      <div className="term-bar" aria-hidden="true">
        leetcode --stats
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 id="lc-title" className="text-accent text-lg font-bold">
          LeetCode
        </h3>
        <p className="mt-4">
          <span className="text-ink text-4xl font-bold">{data.solved.all}</span>
          <span className="text-muted"> problems solved</span>
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {LEVELS.map((level) => (
            <div key={level}>
              <dt className="text-muted text-xs capitalize">{level}</dt>
              <dd className="text-ink text-xl font-bold">
                {data.solved[level]}
                {data.totals[level] > 0 && (
                  <span className="text-muted text-xs font-normal"> / {data.totals[level]}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        {data.ranking !== null && (
          <p className="text-muted mt-4 text-sm">
            Global ranking <span className="text-ink">#{formatCompactNumber(data.ranking)}</span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 pt-4 text-sm">
          <ExternalLink href={data.profileUrl}>@{data.username} on LeetCode</ExternalLink>
          {stats.source === "snapshot" && (
            <p className="text-muted text-xs">Stats as of {formatAsOf(stats.fetchedAt)}</p>
          )}
        </div>
      </div>
    </article>
  );
}
