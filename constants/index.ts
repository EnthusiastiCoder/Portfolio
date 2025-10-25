import {
  RxGithubLogo,
  RxTwitterLogo,
  RxLinkedinLogo,
} from "react-icons/rx";

export const SOCIALS = [
  {
    name: "Twitter",
    icon: RxTwitterLogo,
    link: "https://x.com/enthusiasticodr",
  },
  {
    name: "GitHub",
    icon: RxGithubLogo,
    link: "https://github.com/EnthusiastiCoder",
  },
  {
    name: "LinkedIn",
    icon: RxLinkedinLogo,
    link: "https://www.linkedin.com/in/arpan-mandal-74a0672a2/",
  },
] as const;

export const FRONTEND_SKILL = [
  {
    skill_name: "HTML5",
    image: "html.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "CSS",
    image: "css.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "JavaScript",
    image: "js.png",
    width: 65,
    height: 65,
  },
  {
    skill_name: "Tailwind CSS",
    image: "tailwind.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "React",
    image: "react.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "React Query",
    image: "reactquery.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "TypeScript",
    image: "ts.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Next.js 14",
    image: "next.png",
    width: 80,
    height: 80,
  },
] as const;

export const BACKEND_SKILL = [
  {
    skill_name: "Node.js",
    image: "node.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Express.js",
    image: "express.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "MongoDB",
    image: "mongodb.png",
    width: 40,
    height: 40,
  },
  {
    skill_name: "Firebase",
    image: "firebase.png",
    width: 55,
    height: 55,
  },
  {
    skill_name: "PostgreSQL",
    image: "postgresql.png",
    width: 70,
    height: 70,
  },
  {
    skill_name: "MySQL",
    image: "mysql.png",
    width: 70,
    height: 70,
  },
  {
    skill_name: "Graphql",
    image: "graphql.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Redis",
    image: "Redis.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "AWS",
    image: "AWS.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Spring Boot",
    image: "Spring.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Fast API",
    image: "FastAPI.png",
    width: 80,
    height: 80,
  }
] as const;

export const LANGUAGES_SKILL = [
  {
    skill_name: "Python",
    image: "Python.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "C",
    image: "C.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "C++",
    image: "C++ (CPlusPlus).png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Java",
    image: "java.png",
    width: 80,
    height: 80,
  }
] as const;

export const DEVOPS_SKILL = [
  {
    skill_name: "Docker",
    image: "docker.png",
    width: 70,
    height: 70,
  },
  {
    skill_name: "Kubernetes",
    image: "kubernetes.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Git",
    image: "git.png",
    width: 80,
    height: 80,
  }
] as const;

export const OTHER_SKILL = [
  {
    skill_name: "Figma",
    image: "figma.png",
    width: 50,
    height: 50,
  },
  {
    skill_name: "NGINX",
    image: "NGINX.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Linux",
    image: "Linux.png",
    width: 80,
    height: 80,
  },
  {
    skill_name: "Heroku",
    image: "Heroku.png",
    width: 80,
    height: 80,
  },
] as const;

export const PROJECTS = [
  {
    title: "Paediprime",
    description:
      'PaediPrime aims to streamline the process of user registration, authentication, and appointment scheduling in a secure and modular web environment. By leveraging modern authentication standards and a flexible architecture, the platform ensures both user-friendliness and enterprise-grade security. PaediPrime is especially valuable for clinics, small-scale healthcare providers, and service organisations that need a secure and modern way to manage user authentication and appointments—without relying on outdated password systems.',
    image: "/projects/project-1.png",
    link: "https://example.com",
  },
  {
    title: "BloodBank",
    description:
      'BloodBank is a web-based management system designed to streamline the process of blood donation, inventory tracking, and donor-recipient coordination. Built using the Node.js and MongoDB stack, the system provides modules for user registration, donor and recipient management, blood inventory monitoring, and request handling. It focuses on efficiency, transparency, and accessibility in blood management workflows, enabling hospitals, donors, and blood banks to operate in sync through a secure digital interface.',
    image: "/projects/project-2.png",
    link: "https://example.com",
  },
] as const;

export const FOOTER_DATA = [
  {
    title: "Community",
    data: [
      {
        name: "GitHub",
        icon: RxGithubLogo,
        link: "https://github.com/EnthusiastiCoder",
      },
    ],
  },
  {
    title: "Social Media",
    data: [
      {
        name: "Twitter",
        icon: RxTwitterLogo,
        link: "https://x.com/enthusiasticodr",
      },
      {
        name: "Linkedin",
        icon: RxLinkedinLogo,
        link: "https://www.linkedin.com/in/arpan-mandal-74a0672a2/",
      },
    ],
  },
] as const;

export const NAV_LINKS = [
  {
    title: "Skills",
    link: "#skills",
  },
  {
    title: "Projects",
    link: "#projects",
  },
] as const;

