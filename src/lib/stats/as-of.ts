const asOfFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "14 Nov 2026" from an ISO timestamp, in UTC so server and client agree. */
export function formatAsOf(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : asOfFormatter.format(time);
}
