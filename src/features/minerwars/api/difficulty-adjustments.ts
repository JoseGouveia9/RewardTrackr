export interface DifficultyEntry {
  percent: number;
  highlighted: boolean;
}

interface DifficultyEpoch {
  date: string;
  difficulty: number;
  satsPerTerahash: number;
}

const SATS_PER_TERAHASH_FACTOR = (3.125e8 * 86400 * 1e12) / Math.pow(2, 32);

let rawCache: unknown[] | null = null;
let rawInFlight: Promise<unknown[]> | null = null;

/** Memoizes the mempool.space history and dedupes in-flight requests; failures yield []. */
function fetchRaw(): Promise<unknown[]> {
  if (rawCache) return Promise.resolve(rawCache);
  if (rawInFlight) return rawInFlight;

  rawInFlight = fetch("https://mempool.space/api/v1/mining/difficulty-adjustments/all")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown[]>;
    })
    .then((data) => {
      rawCache = data;
      rawInFlight = null;
      return data;
    })
    .catch(() => {
      rawInFlight = null;
      return [];
    });

  return rawInFlight;
}

/**
 * Maps the 1st and 2nd day after each adjustment to its change in % (fractions are scaled).
 * The 2nd day is flagged `highlighted` (yellow border).
 */
function parseAdjustments(raw: unknown): Map<string, DifficultyEntry> {
  const map = new Map<string, DifficultyEntry>();
  if (!Array.isArray(raw)) return map;

  for (const item of raw) {
    let time: number;
    let change: number;

    if (Array.isArray(item)) {
      time = item[0] as number;
      change = item[3] as number;
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      time = record.time as number;
      change = (record.adjustment ?? record.change) as number;
    } else {
      continue;
    }

    if (typeof time !== "number" || typeof change !== "number") continue;

    const percent = Math.abs(change) < 1.5 && Math.abs(change) > 0 ? change * 100 : change;

    const firstDayAfter = new Date((time + 86400) * 1000).toISOString().slice(0, 10);
    const secondDayAfter = new Date((time + 86400 * 2) * 1000).toISOString().slice(0, 10);

    map.set(firstDayAfter, { percent, highlighted: false });
    map.set(secondDayAfter, { percent, highlighted: true });
  }
  return map;
}

export function fetchDifficultyAdjustments(): Promise<Map<string, DifficultyEntry>> {
  return fetchRaw().then(parseAdjustments);
}

/**
 * Sorted ascending by date; covers the full Bitcoin history.
 * `satsPerTH` counts the block subsidy only (no fees).
 */
export function fetchDifficultyEpochs(): Promise<DifficultyEpoch[]> {
  return fetchRaw().then((raw) => {
    if (!Array.isArray(raw)) return [];
    const epochs: DifficultyEpoch[] = [];
    for (const item of raw) {
      let time: number;
      let difficulty: number;
      if (Array.isArray(item)) {
        time = item[0] as number;
        difficulty = item[2] as number;
      } else if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        time = record.time as number;
        difficulty = record.difficulty as number;
      } else {
        continue;
      }
      if (typeof time !== "number" || typeof difficulty !== "number" || difficulty <= 0) continue;
      epochs.push({
        date: new Date(time * 1000).toISOString().slice(0, 10),
        difficulty,
        satsPerTerahash: SATS_PER_TERAHASH_FACTOR / difficulty,
      });
    }
    return epochs.sort((left, right) => left.date.localeCompare(right.date));
  });
}

/** Each date uses the latest epoch that started strictly before it. */
export function satsPerTerahashForDates(
  epochs: DifficultyEpoch[],
  dates: string[],
): { byDate: Map<string, number>; latestSatsPerTerahash: number | null } {
  const byDate = new Map<string, number>();
  for (const dateString of dates) {
    let applicable: DifficultyEpoch | null = null;
    for (const epoch of epochs) {
      if (epoch.date < dateString) applicable = epoch;
    }
    if (applicable) byDate.set(dateString, applicable.satsPerTerahash);
  }
  const latest = epochs[epochs.length - 1];
  return { byDate, latestSatsPerTerahash: latest?.satsPerTerahash ?? null };
}

export async function fetchSatsPerTerahashForDates(dates: string[]) {
  return satsPerTerahashForDates(await fetchDifficultyEpochs(), dates);
}
