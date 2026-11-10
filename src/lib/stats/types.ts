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

export interface GitHubStats {
  login: string;
  name: string | null;
  avatarUrl: string;
  profileUrl: string;
  followers: number;
  publicRepos: number;
  totalStars: number;
  topLanguages: GitHubLanguageCount[];
  featuredRepos: GitHubRepoSummary[];
}

export interface DifficultyCounts {
  all: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface LeetCodeContest {
  rating: number;
  attended: number;
  topPercentage: number | null;
}
