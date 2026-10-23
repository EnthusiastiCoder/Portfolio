import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import SectionWord from "@/components/motion/SectionWord";
import { skills } from "@/content/skills";
import { profile } from "@/data/profile";
import { getAllProjects } from "@/lib/projects";

/** What each kind of work means for the person on the other side of the screen. */
const CAPABILITIES = [
  {
    word: "Open",
    title: "Tools you can open and use straight away",
    body: "You land on the page and the tool is there, ready for your file.",
  },
  {
    word: "Fast",
    title: "Pages that respond quickly",
    body: "I care about performance, so nobody waits around to get started.",
  },
  {
    word: "For all",
    title: "Built for everyone",
    body: "I care about accessibility: keyboard, screen readers and small screens included.",
  },
] as const;

/**
 * RED: a stack matrix grouped by layer.
 * BLUE: "what I make for people" capability tiles in large type, entering
 * from the top and the bottom. BOTH: the matrix and the tiles together.
 */
export default function Skills() {
  const products = getAllProjects().map((p) => p.title);
  return (
    <section
      id="skills"
      aria-labelledby="skills-title"
      className="sect sect--skills"
      data-motion="blue"
    >
      <SectionWord>Craft</SectionWord>
      <div className="sect-inner">
        <SectionHeading id="skills-title" command="stack --matrix" title="Skills" />

        <ModeOnly modes={["red", "both"]} className="matrix">
          <table className="matrix-table" data-enter="depth-in">
            <caption className="sr-only">Stack by layer</caption>
            <thead>
              <tr>
                <th scope="col">Layer</th>
                <th scope="col">Tools</th>
                <th scope="col" className="matrix-n">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {skills.map((group, i) => (
                <tr
                  key={group.label}
                  data-enter={i % 2 === 0 ? "left" : "right"}
                  data-stagger={String(i + 1)}
                >
                  <th scope="row">{group.label}</th>
                  <td>
                    <ul className="matrix-chips">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="matrix-n">{group.items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModeOnly>

        <ModeOnly modes={["blue", "both"]} className="tiles">
          <p className="tiles-lede" data-enter="top">
            What I make for people
          </p>
          <ul className="tiles-grid">
            {CAPABILITIES.map((cap, i) => (
              <li
                key={cap.word}
                className="tile"
                data-enter={i % 2 === 0 ? "bottom" : "top"}
                data-stagger={String(i * 2 + 1)}
              >
                <span className="tile-word" aria-hidden="true">
                  {cap.word}
                </span>
                <h3 className="tile-title">{cap.title}</h3>
                <p className="tile-body">{cap.body}</p>
              </li>
            ))}
          </ul>
          <p className="tiles-proof" data-enter="bottom" data-stagger="4">
            {profile.tagline} Live right now: {products.join(", ")}.
          </p>
        </ModeOnly>
      </div>
    </section>
  );
}
