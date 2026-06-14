// mempool.space returns [[timestamp, height, difficulty, changePercent], ...]
// Map value: pct = change percentage, highlighted = true on the 2-days-after row (yellow border)
export interface DifficultyEntry {
  pct: number;
  highlighted: boolean;
}

export interface DifficultyEpoch {
  /** Date string YYYY-MM-DD of the retarget block */
  date: string;
  difficulty: number;
  /** Estimated sats per TH per day (block subsidy only) */
  satsPerTH: number;
}

const SATS_PER_TH_FACTOR = (3.125e8 * 86400 * 1e12) / Math.pow(2, 32);

// Shared raw fetch — cached once for both consumers
let rawCache: unknown[] | null = null;
let rawInFlight: Promise<unknown[]> | null = null;

function fetchRaw(): Promise<unknown[]> {
  if (rawCache) return Promise.resolve(rawCache);
  if (rawInFlight) return rawInFlight;

  rawInFlight = fetch("https://mempool.space/api/v1/mining/difficulty-adjustments/all")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<unknown[]>;
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
      const o = item as Record<string, unknown>;
      time = o.time as number;
      change = (o.adjustment ?? o.change) as number;
    } else {
      continue;
    }

    if (typeof time !== "number" || typeof change !== "number") continue;

    const pct = Math.abs(change) < 1.5 && Math.abs(change) > 0 ? change * 100 : change;

    const d1 = new Date((time + 86400) * 1000).toISOString().slice(0, 10);
    const d2 = new Date((time + 86400 * 2) * 1000).toISOString().slice(0, 10);

    map.set(d1, { pct, highlighted: false });
    map.set(d2, { pct, highlighted: true });
  }
  return map;
}

export function fetchDifficultyAdjustments(): Promise<Map<string, DifficultyEntry>> {
  return fetchRaw().then(parseAdjustments);
}

// Returns all difficulty retarget epochs sorted ascending by date.
// Each entry has the date, difficulty value, and sats/TH/day (block subsidy only). Covers full Bitcoin history.
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
        const o = item as Record<string, unknown>;
        time = o.time as number;
        difficulty = o.difficulty as number;
      } else {
        continue;
      }
      if (typeof time !== "number" || typeof difficulty !== "number" || difficulty <= 0) continue;
      epochs.push({
        date: new Date(time * 1000).toISOString().slice(0, 10),
        difficulty,
        satsPerTH: SATS_PER_TH_FACTOR / difficulty,
      });
    }
    return epochs.sort((a, b) => a.date.localeCompare(b.date));
  });
}
