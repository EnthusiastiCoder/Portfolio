import About from "@/components/About";
import Contact from "@/components/Contact";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import Personality from "@/components/Personality";
import Projects from "@/components/Projects";
import Skills from "@/components/Skills";
import PillScene from "@/components/matrix/PillScene";
import SectionDots from "@/components/motion/SectionDots";
import { siteConfig } from "@/config/site";
import { profile } from "@/data/profile";

export const revalidate = 21600;

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: siteConfig.name,
  url: siteConfig.url,
  jobTitle: profile.role,
  email: `mailto:${siteConfig.email}`,
  sameAs: [siteConfig.links.github, siteConfig.links.linkedin],
};

export default function Home() {
  return (
    <main id="main" className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="home-hero">
        <PillScene />
      </div>
      <SectionDots />
      <Personality />
      <About />
      <Projects />
      {siteConfig.showExperience && <ExperienceTimeline />}
      <Skills />
      <Contact />
    </main>
  );
}
