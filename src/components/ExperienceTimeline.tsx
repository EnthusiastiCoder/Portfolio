import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import { siteConfig } from "@/config/site";
import { experience } from "@/data/experience";
import { sortExperience } from "@/lib/experience";
import { formatDateRange } from "@/lib/format";

export default function ExperienceTimeline() {
  const items = sortExperience(experience);
  return (
    <section id="experience" aria-labelledby="experience-title" className="panel p-6 sm:p-8">
      <SectionHeading id="experience-title" command="history | tail" title="Experience" />
      <ol className="sd-timeline border-accent-dim/50 space-y-8 border-l pl-6">
        {items.map((item) => (
          <li key={item.id} className="relative">
            <span aria-hidden="true" className="timeline-dot" />
            <h3 className="text-ink text-lg font-bold">
              {item.role} <span className="text-accent">@ {item.company}</span>
            </h3>
            <p className="text-muted text-sm">
              {formatDateRange(item.start, item.end)}
              {item.location && ` · ${item.location}`}
            </p>
            <p className="mt-2 leading-relaxed">{item.summary}</p>
            <ul className="mt-2 space-y-1">
              {item.highlights.map((highlight, index) => {
                const row = (
                  <>
                    <span aria-hidden="true" className="text-accent absolute left-0">
                      &gt;
                    </span>
                    {highlight}
                  </>
                );
                // Blue shows the first bullet, both the first 2, red all of them.
                if (index === 0) {
                  return (
                    <li key={highlight} className="relative pl-5 leading-relaxed">
                      {row}
                    </li>
                  );
                }
                return (
                  <ModeOnly
                    key={highlight}
                    as="li"
                    modes={index === 1 ? ["red", "both"] : ["red"]}
                    className="relative pl-5 leading-relaxed"
                  >
                    {row}
                  </ModeOnly>
                );
              })}
            </ul>
            <ModeOnly modes={["red"]}>
              <p className="text-muted mt-2 text-xs">{item.tech.join(" · ")}</p>
            </ModeOnly>
          </li>
        ))}
      </ol>
      <p className="mt-8">
        <a href={siteConfig.resumePath} download className="btn">
          Download resume (PDF)
        </a>
      </p>
    </section>
  );
}
