export type StatsSource = "live" | "snapshot";

export interface Sourced<T> {
  data: T;
  source: StatsSource;
  fetchedAt: string;
}

export interface GitHubRepoSummary {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  updatedAt: string;
}

export interface GitHubLanguageCount {
  name: string;
  count: number;
}
