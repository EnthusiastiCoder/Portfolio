import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { skills } from "@/content/skills";
import { experience } from "@/data/experience";
import { profile } from "@/data/profile";
import { formatMonth } from "@/lib/format";
import { getAllProjects } from "@/lib/projects";

/** The earliest start month in the experience data, e.g. "May 2022". */
function shippingSince(): string {
  const first = [...experience].map((e) => e.start).sort()[0];
  return first ? formatMonth(first) : "";
}

/**
 * RED: a spec sheet (key/value grid) that steps in from the left, row by row.
 * BLUE: an oversized two-line statement split to opposite corners, plus a
 * short human paragraph, arriving from depth. BOTH: the two together.
 */
export default function About() {
  const stack = skills.flatMap((g) => g.items).slice(0, 8);
  const products = getAllProjects().map((p) => p.title);
  const spec: [string, string][] = [
    ["name", profile.name],
    ["role", profile.role],
    ["location", profile.location],
    ["focus", profile.tagline],
    ["stack", stack.join(", ")],
    ["shipping_since", shippingSince()],
    ["products_live", `${products.length}: ${products.join(", ")}`],
  ];
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="sect sect--about"
      data-motion="red"
    >
      <SectionWord>About</SectionWord>
      <div className="sect-inner">
        <SectionHeading id="about-title" command="cat about.spec" title="About" />

        <ModeOnly modes={["red", "both"]} className="spec">
          <p className="spec-file" aria-hidden="true">
            The detail, {spec.length} facts
          </p>
          <dl className="spec-grid">
            {spec.map(([key, value], i) => (
              <div
                key={key}
                className="spec-row"
                data-enter="left"
                data-stagger={String(Math.min(i, 6))}
              >
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="spec-notes" data-enter="depth-out">
            {profile.about.slice(1).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </ModeOnly>

        <ModeOnly modes={["blue", "both"]} className="statement">
          <p className="statement-line statement-line--a" data-enter="depth-in">
            Rough ideas,
          </p>
          <p className="statement-line statement-line--b" data-enter="depth-in" data-stagger="2">
            reliable products.
          </p>
          <p className="statement-body" data-enter="bottom" data-stagger="3">
            {profile.about[0]} I care how the things I build feel to the people who open them.
          </p>
        </ModeOnly>
      </div>
    </section>
  );
}
