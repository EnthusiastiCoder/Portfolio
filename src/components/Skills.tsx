import SectionHeading from "@/components/SectionHeading";
import { skills } from "@/content/skills";

export default function Skills() {
  return (
    <section id="skills" aria-labelledby="skills-title" className="panel p-6 sm:p-8">
      <SectionHeading id="skills-title" command="ls ~/skills" title="Skills" />
      <div className="grid gap-4 sm:grid-cols-2">
        {skills.map((group) => (
          <div key={group.label} className="term p-4">
            <h3 className="text-accent font-bold">{group.label}</h3>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {group.items.map((item) => (
                <li key={item} className="border-accent-dim/50 rounded border px-2 py-0.5">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
