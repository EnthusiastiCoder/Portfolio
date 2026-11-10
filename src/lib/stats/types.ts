export type StatsSource = "live" | "snapshot";

export interface Sourced<T> {
  data: T;
  source: StatsSource;
  fetchedAt: string;
}
