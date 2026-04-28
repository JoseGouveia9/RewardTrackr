// mempool.space returns [[timestamp, height, difficulty, changePercent], ...]
// Map value: pct = change percentage, highlighted = true on the 2-days-after row (yellow border)
export interface DifficultyEntry {
  pct: number;
  highlighted: boolean;
}

let cached: Map<string, DifficultyEntry> | null = null;
let inFlight: Promise<Map<string, DifficultyEntry>> | null = null;

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
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = fetch("https://mempool.space/api/v1/mining/difficulty-adjustments/all")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((raw) => {
      const map = parseAdjustments(raw);
      cached = map;
      inFlight = null;
      return map;
    })
    .catch(() => {
      inFlight = null;
      return new Map<string, DifficultyEntry>();
    });

  return inFlight;
}
