/**
 * Builds the list of UTC-day date strings (inclusive) from `start` to `end`, e.g.
 * "2024-01-01" -> "2024-01-03" yields ["2024-01-01", "2024-01-02", "2024-01-03"].
 */
export function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = new Date(start + "T00:00:00Z"); ; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateString = date.toISOString().slice(0, 10);
    dates.push(dateString);
    if (dateString >= end) break;
  }
  return dates;
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Fractional days the league has mined so far: cycle start to the last completed round's end,
 * capped at the cycle length. Maintenance must cover the same window as `sumAllMultipliers`
 * (every completed round, solo days included), otherwise the per-block share is over-diluted.
 * Returns null when no completed round has an end date.
 */
export function computeLeagueElapsedDays(
  completedRounds: ReadonlyArray<{ endedAt: string | null }>,
  cycleStart: string,
  cycleLengthDays: number,
): number | null {
  let lastEndedAt = Number.NEGATIVE_INFINITY;
  for (const round of completedRounds) {
    const endedAt = round.endedAt ? Date.parse(round.endedAt) : Number.NaN;
    if (Number.isFinite(endedAt) && endedAt > lastEndedAt) lastEndedAt = endedAt;
  }
  if (!Number.isFinite(lastEndedAt)) return null;
  const elapsed = (lastEndedAt - Date.parse(`${cycleStart}T00:00:00.000Z`)) / DAY_MILLISECONDS;
  return Math.min(cycleLengthDays, Math.max(0, elapsed));
}

/**
 * Offsets a UTC-day date string by `days` (may be negative), e.g. addUtcDays("2024-01-01", 1)
 * -> "2024-01-02".
 */
export function addUtcDays(dateString: string, days: number): string {
  const date = new Date(dateString + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
