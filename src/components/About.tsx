import ModeOnly from "@/components/ModeOnly";
import SectionHeading from "@/components/SectionHeading";
import { profile } from "@/data/profile";

export default function About() {
  return (
    <section aria-labelledby="about-title" id="about" className="panel p-6 sm:p-8">
      <SectionHeading id="about-title" command="cat about.txt" title="About" />
      <div className="max-w-3xl space-y-4 leading-relaxed">
        {profile.about.slice(0, 1).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {/* Blue (surface) mode keeps only the opening paragraph. */}
        <ModeOnly modes={["red", "both"]} className="space-y-4">
          {profile.about.slice(1).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </ModeOnly>
      </div>
    </section>
  );
}
