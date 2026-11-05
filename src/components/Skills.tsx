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
 * RED: each skill with the products that prove it. A product counts when its
 * stack (src/data/projects.ts) lists a matching tool, so nothing is claimed
 * that a shipped product does not use.
 */
const SKILL_EVIDENCE: { skill: string; tools: RegExp }[] = [
  { skill: "Machine learning in the browser", tools: /onnx|transformers\.js|tesseract/i },
  {
    skill: "WebAssembly and media codecs",
    tools: /jsquash|libheif|zxing-wasm|qpdf|webcodecs|mediabunny/i,
  },
  { skill: "Offline-first web apps", tools: /workbox|vite-pwa|service worker/i },
  { skill: "PDF and document processing", tools: /pdf-lib|pdf\.js|qpdf/i },
  { skill: "Astro, Svelte and Preact front ends", tools: /^astro|svelte|preact/i },
  { skill: "End-to-end and unit testing", tools: /vitest|playwright|pytest/i },
  { skill: "Python desktop apps", tools: /pyqt|pyinstaller/i },
];

function provenSkills(): { skill: string; products: string[] }[] {
  const products = getAllProjects();
  return SKILL_EVIDENCE.map(({ skill, tools }) => ({
    skill,
    products: products.filter((p) => p.stack.some((t) => tools.test(t))).map((p) => p.title),
  })).filter((row) => row.products.length > 0);
}

/**
 * RED: every skill next to the shipped products that prove it.
 * GREEN (no pill): the stack matrix grouped by layer.
 * BLUE: "what I make for people" capability tiles in large type, entering
 * from the top and the bottom. GREEN shows the matrix and the tiles together.
 */
export default function Skills() {
  const products = getAllProjects().map((p) => p.title);
  const proven = provenSkills();
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

        <ModeOnly modes={["red"]} className="matrix">
          <table className="matrix-table" data-enter="depth-in">
            <caption className="sr-only">Skills and the products that prove them</caption>
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Where it ships</th>
                <th scope="col" className="matrix-n">
                  Products
                </th>
              </tr>
            </thead>
            <tbody>
              {proven.map((row, i) => (
                <tr
                  key={row.skill}
                  data-enter={i % 2 === 0 ? "left" : "right"}
                  data-stagger={String(i + 1)}
                >
                  <th scope="row">{row.skill}</th>
                  <td>
                    <ul className="matrix-chips">
                      {row.products.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="matrix-n">{row.products.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModeOnly>

        <ModeOnly modes={["both"]} className="matrix">
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
