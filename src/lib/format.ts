const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Formats a `YYYY-MM` string as e.g. "Jan 2023", without touching time zones. */
export function formatMonth(yearMonth: string): string {
  const match = MONTH_RE.exec(yearMonth);
  if (!match) throw new Error(`Expected YYYY-MM, got "${yearMonth}"`);
  return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Formats a month range with an en dash; a null end means the role is current. */
export function formatDateRange(start: string, end: string | null): string {
  return `${formatMonth(start)} – ${end === null ? "Present" : formatMonth(end)}`;
}

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formats a number compactly, e.g. 1234 -> "1.2K". */
export function formatCompactNumber(value: number): string {
  return compactFormatter.format(value);
}
