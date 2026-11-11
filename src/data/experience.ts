export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  /** Start month, `YYYY-MM`. */
  start: string;
  /** End month, `YYYY-MM`, or null for a current role. */
  end: string | null;
  location?: string;
  summary: string;
  highlights: string[];
  tech: string[];
}
