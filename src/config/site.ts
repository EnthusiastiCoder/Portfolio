const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const handles = {
  github: "EnthusiastiCoder",
  leetcode: "EnthusiastiCoder",
} as const;

export const siteConfig = {
  name: "Arpan Mandal",
  title: "Arpan Mandal — Software Engineer",
  description:
    "Arpan Mandal is a software engineer building fast, reliable web applications. Projects, experience, and live GitHub and LeetCode stats.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (vercelUrl ? `https://${vercelUrl}` : "https://portfolio-enthusiasticoder.vercel.app"),
  email: "enthusiasticoder@gmail.com",
  handles,
  links: {
    github: `https://github.com/${handles.github}`,
    leetcode: `https://leetcode.com/u/${handles.leetcode}/`,
    linkedin: "https://www.linkedin.com/in/arpan-mandal-74a0672a2/",
  },
  resumePath: "/resume.pdf",
  copyright: "© Arpan Mandal. All Rights Reserved.",
} as const;

export type SiteConfig = typeof siteConfig;
