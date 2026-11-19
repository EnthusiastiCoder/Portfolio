const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const handles = {
  github: "EnthusiastiCoder",
} as const;

export const siteConfig = {
  name: "Arpan Mandal",
  title: "Arpan Mandal — Software Engineer",
  description:
    "Arpan Mandal is a software engineer building fast, reliable web applications. Projects and skills.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (vercelUrl ? `https://${vercelUrl}` : "https://enthu.xyz"),
  email: "enthusiasticoder@gmail.com",
  handles,
  links: {
    github: `https://github.com/${handles.github}`,
    linkedin: "https://www.linkedin.com/in/arpan-mandal-74a0672a2/",
  },
  /** Placeholder experience and resume are hidden until real details exist. */
  showExperience: false,
  resumePath: "/resume.pdf",
  copyright: "© Arpan Mandal. All Rights Reserved.",
} as const;

export type SiteConfig = typeof siteConfig;
