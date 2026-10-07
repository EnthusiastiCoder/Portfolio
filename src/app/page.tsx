import About from "@/components/About";
import Contact from "@/components/Contact";
import ExperienceTimeline from "@/components/ExperienceTimeline";
import Projects from "@/components/Projects";
import Reveal from "@/components/Reveal";
import Skills from "@/components/Skills";
import StatsSection from "@/components/StatsSection";
import PillScene from "@/components/matrix/PillScene";
import { siteConfig } from "@/config/site";
import { profile } from "@/data/profile";
import { getGitHubStats } from "@/lib/stats/github";
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
  const [github, leetcode] = await Promise.all([getGitHubStats(), getLeetCodeStats()]);

  return (
    <main id="main" className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <PillScene />
      <Reveal>
        <About />
      </Reveal>
      <Reveal>
        <StatsSection github={github} leetcode={leetcode} />
      </Reveal>
      <Reveal>
        <Projects repos={github.data.featuredRepos} />
      </Reveal>
      <Reveal>
        <ExperienceTimeline />
      </Reveal>
      <Reveal>
        <Skills />
      </Reveal>
      <Reveal>
        <Contact />
      </Reveal>
    </main>
  );
}
