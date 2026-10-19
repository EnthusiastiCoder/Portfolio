import About from "@/components/About";
import Contact from "@/components/Contact";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import Projects from "@/components/Projects";
import Skills from "@/components/Skills";
import PillScene from "@/components/matrix/PillScene";
import SectionDots from "@/components/motion/SectionDots";
import { siteConfig } from "@/config/site";
import { profile } from "@/data/profile";
import { getLeetCodeStats } from "@/lib/stats/leetcode";

export const revalidate = 21600;

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: siteConfig.name,
  url: siteConfig.url,
  jobTitle: profile.role,
  email: `mailto:${siteConfig.email}`,
  sameAs: [siteConfig.links.github, siteConfig.links.leetcode, siteConfig.links.linkedin],
};

export default async function Home() {
  const leetcode = await getLeetCodeStats();

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
      <About />
      <Projects />
      <ExperienceTimeline />
      <Skills leetcode={leetcode} />
      <Contact />
    </main>
  );
}
