export interface Project {
  /** Kebab-case slug; matches `src/content/projects/<slug>.mdx`. */
  slug: string;
  title: string;
  summary: string;
  tech: string[];
  /** Month the project shipped, `YYYY-MM`. */
  date: string;
  featured: boolean;
  repo?: string;
  demo?: string;
}
