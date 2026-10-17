import LeetCodeStatsCard from "@/components/LeetCodeStatsCard";
import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import { skills } from "@/content/skills";
import type { LeetCodeStats, Sourced } from "@/lib/stats/types";

export default function Skills({ leetcode }: { leetcode?: Sourced<LeetCodeStats> }) {
  return (
    <section id="skills" aria-labelledby="skills-title" className="panel p-6 sm:p-8">
      <SectionHeading id="skills-title" command="ls ~/skills" title="Skills" />
      <div className="grid gap-4 sm:grid-cols-2">
        {skills.map((group) => (
          <div key={group.label} className="term p-4">
            <h3 className="text-accent font-bold">{group.label}</h3>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {group.items.slice(0, 6).map((item) => (
                <li key={item} className="border-accent-dim/50 rounded border px-2 py-0.5">
                  {item}
                </li>
              ))}
              {/* Blue (surface) mode shows the first 6 per group. */}
              {group.items.slice(6).map((item) => (
                <ModeOnly
                  key={item}
                  as="li"
                  modes={["red", "both"]}
                  className="border-accent-dim/50 rounded border px-2 py-0.5"
                >
                  {item}
                </ModeOnly>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* LeetCode is engineering depth: red only. */}
      {leetcode ? (
        <ModeOnly modes={["red"]} className="mt-4">
          <LeetCodeStatsCard stats={leetcode} />
        </ModeOnly>
      ) : null}
    </section>
  );
}
