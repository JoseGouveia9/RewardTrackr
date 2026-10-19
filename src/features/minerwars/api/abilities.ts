import { postJson } from "@/lib/http";
import { API } from "./base";

type AbilityInfo = { priceInGMT: number; type: string };

let abilityCatalogCache: {
  data: Map<string, AbilityInfo>;
  boostX1ByDate: Array<{ from: string; to: string; value: number }>;
  timestamp: number;
} | null = null;
const ABILITY_CATALOG_CACHE_TIME_TO_LIVE = 30 * 60 * 1000;

/**
 * Cached for 30 min; also extracts the "Boost X1" versions (value defaults to 2000 when missing).
 */
async function loadAbilityCatalog(headers: Record<string, string>) {
  if (
    abilityCatalogCache &&
    Date.now() - abilityCatalogCache.timestamp < ABILITY_CATALOG_CACHE_TIME_TO_LIVE
  ) {
    return abilityCatalogCache;
  }
  const response = await postJson<{
    data: {
      array: Array<{
        id: string;
        name: string;
        type: string;
        priceInGMT?: number;
        data?: { value?: number };
        availableFrom?: string;
        availableTo?: string;
      }>;
    };
  }>(`${API}/api/nft-game/nft-game-ability/find-all`, headers, {});

  const array = response.data?.array ?? [];
  const data = new Map<string, AbilityInfo>();
  for (const ability of array)
    data.set(ability.id, { priceInGMT: ability.priceInGMT ?? 0, type: ability.type });

  const boostX1ByDate = array
    .filter((ability) => ability.name === "Boost X1")
    .map((ability) => ({
      from: ability.availableFrom ?? "",
      to: ability.availableTo ?? "",
      value: ability.data?.value ?? 2000,
    }));

  abilityCatalogCache = { data, boostX1ByDate, timestamp: Date.now() };
  return abilityCatalogCache;
}

/** The catalog is versioned: the same boost gets a new id whenever its price/value changes. */
export async function getAbilityCosts(
  headers: Record<string, string>,
): Promise<Map<string, AbilityInfo>> {
  return (await loadAbilityCatalog(headers)).data;
}

/**
 * "Boost X1" value is the PPS denominator in GoMining's Power-Up formulas.
 * Picks the version active on referenceDate.
 */
export async function getBoostX1Value(
  headers: Record<string, string>,
  referenceDate: string,
): Promise<number> {
  const { boostX1ByDate } = await loadAbilityCatalog(headers);
  const active = boostX1ByDate.find(
    (boost) => boost.from <= referenceDate && referenceDate <= boost.to,
  );
  return active?.value ?? 2000;
}
