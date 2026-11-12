import GitHubStatsCard from "@/components/GitHubStatsCard";
import LeetCodeStatsCard from "@/components/LeetCodeStatsCard";
import SectionHeading from "@/components/SectionHeading";
import type { GitHubStats, LeetCodeStats, Sourced } from "@/lib/stats/types";

export default function StatsSection({
  github,
  leetcode,
}: {
  github: Sourced<GitHubStats>;
  leetcode: Sourced<LeetCodeStats>;
}) {
  return (
    <section id="stats" aria-labelledby="stats-title" className="panel p-6 sm:p-8">
      <SectionHeading id="stats-title" command="./stats --live" title="Stats" />
      <div className="grid gap-4 md:grid-cols-2">
        <GitHubStatsCard stats={github} />
        <LeetCodeStatsCard stats={leetcode} />
      </div>
    </section>
  );
}
