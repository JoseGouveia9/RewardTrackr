// Builds the list of UTC-day date strings (inclusive) from `start` to `end`, e.g.
// "2024-01-01" -> "2024-01-03" yields ["2024-01-01", "2024-01-02", "2024-01-03"].
export function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = new Date(start + "T00:00:00Z"); ; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateStr = date.toISOString().slice(0, 10);
    dates.push(dateStr);
    if (dateStr === end) break;
  }
  return dates;
}

// Offsets a UTC-day date string by `days` (may be negative), e.g. addUtcDays("2024-01-01", 1)
// -> "2024-01-02".
export function addUtcDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
