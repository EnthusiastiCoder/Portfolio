import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { siteConfig } from "@/config/site";
import { experience } from "@/data/experience";
import { sortExperience } from "@/lib/experience";
import { formatDateRange } from "@/lib/format";

/**
 * RED: a dense log table (dates, role, org, stack, impact) on a vertical rail,
 * rows stepping in from the left. BLUE: large staggered cards alternating left
 * and right with plain summaries, rotating slightly in. BOTH: the two together.
 */
export default function ExperienceTimeline() {
  const items = sortExperience(experience);
  return (
    <section
      id="experience"
      aria-labelledby="experience-title"
      className="sect sect--experience"
      data-motion="red"
    >
      <SectionWord align="right">Work log</SectionWord>
      <div className="sect-inner">
        <SectionHeading id="experience-title" command="git log --roles" title="Experience" />

        <ModeOnly modes={["red", "both"]} className="log sd-timeline">
          <table className="log-table">
            <caption className="sr-only">Roles, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Dates</th>
                <th scope="col">Role</th>
                <th scope="col">Org</th>
                <th scope="col">Stack</th>
                <th scope="col">Impact</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} data-enter="left" data-stagger={String(Math.min(i * 2, 6))}>
                  <td className="log-dates" data-label="Dates">
                    {formatDateRange(item.start, item.end)}
                  </td>
                  <td data-label="Role">{item.role}</td>
                  <td data-label="Org">
                    {item.company}
                    {item.location ? <span className="log-muted"> ({item.location})</span> : null}
                  </td>
                  <td className="log-stack" data-label="Stack">
                    {item.tech.join(", ")}
                  </td>
                  <td data-label="Impact">
                    <ul className="log-impact">
                      {item.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModeOnly>

        <ModeOnly modes={["blue", "both"]} className="story-cards">
          {items.map((item, i) => (
            <article
              key={item.id}
              className={`story-card ${i % 2 === 0 ? "story-card--left" : "story-card--right"}`}
              data-enter="rotate"
              data-stagger={String(Math.min(i, 6))}
            >
              <p className="story-when">
                {item.end === null ? "Now" : formatDateRange(item.start, item.end)}
              </p>
              <h3 className="story-role">
                {item.role}, {item.company}
              </h3>
              <p className="story-summary">{item.summary}</p>
            </article>
          ))}
        </ModeOnly>

        <p className="sect-foot">
          <a href={siteConfig.resumePath} download className="btn">
            Download resume (PDF)
          </a>
        </p>
      </div>
    </section>
  );
}
