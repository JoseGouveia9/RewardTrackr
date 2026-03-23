import { WALLET_TX_KEYS } from "./config/wallet-types";
import { REWARD_CONFIG_MAP, ALL_REWARD_KEYS } from "./config/reward-configs";
import { buildApiHeaders, postJson } from "@/lib/http";

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function checkExportRateLimit(token: string): Promise<void> {
  if (!WORKER_URL) return;
  const response = await fetch(`${WORKER_URL}/rl-check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? "Export limit reached. Please try again tomorrow.");
  }
}

async function rollbackExportRateLimit(token: string): Promise<void> {
  if (!WORKER_URL) return;
  await fetch(`${WORKER_URL}/rl-rollback`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {
    // Non-fatal
  });
}
import { enrichRecords, reenrichFiatValues } from "./utils/transformers";
import { getSessionPriceCache } from "./api/coingecko";
import { buildExcelFromSheets } from "./utils/excel-builder";
import type {
  CacheState,
  ExtraFiatCurrency,
  FetchRewardsOptions,
  GoMiningApiResponse,
  IncrementalFetchOptions,
  RewardConfig,
  RewardKey,
  RewardRecord,
  RewardRequestBody,
  RewardSheetPayload,
} from "./types";
import {
  hasMissingPrices,
  filterCacheableRecords,
  persistPriceCache,
  saveCacheEntry,
} from "./utils/cache";

// Triggers a browser download of the given ArrayBuffer as an .xlsx file.
function triggerFileDownload(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 60_000;

// Wraps an async fetch call with retry logic, retrying up to MAX_RETRIES times on timeout.
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  onProgress?: (msg: string) => void,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      if (!isTimeout || attempt > MAX_RETRIES) throw err;
      onProgress?.(`Request timed out. Retrying in 60s... (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw new Error("Max retries exceeded");
}

// Fetches all paginated records for a sheet config, supporting incremental (new-only) mode.
async function fetchAllPages(
  config: RewardConfig,
  accessToken: string,
  incremental?: IncrementalFetchOptions,
  onProgress?: (msg: string) => void,
): Promise<{ records: unknown[]; totalCount: number | null }> {
  const headers = buildApiHeaders(accessToken);
  const all: unknown[] = [];
  let pointer = config.pagination === "cursor" ? Date.now() : 0;
  let guard = 0;
  let totalCount: number | null = null;

  const knownCreatedAt = new Set(
    incremental?.knownCreatedAt?.filter((v): v is string => typeof v === "string") ?? [],
  );
  const currentRunDates = new Set<string>();
  const knownTotalCount =
    typeof incremental?.knownTotalCount === "number" ? incremental.knownTotalCount : null;
  const incrementalMode = knownCreatedAt.size > 0;
  let expectedNewItems = 0;

  while (guard < 1000) {
    guard += 1;
    const payload = await fetchWithRetry(
      () => postJson<GoMiningApiResponse>(config.apiUrl, headers, config.buildBody(pointer)),
      onProgress,
    );
    const page = payload?.data?.array || [];

    if (totalCount === null && payload?.data?.count !== undefined) {
      totalCount = payload.data.count ?? null;
      if (
        incrementalMode &&
        knownTotalCount !== null &&
        totalCount !== null &&
        totalCount > knownTotalCount
      ) {
        expectedNewItems = totalCount - knownTotalCount;
      }
    }

    if (!Array.isArray(page) || page.length === 0) break;

    if (incrementalMode) {
      const newItems = page.filter((item) => {
        const createdAt = String((item as Record<string, unknown>)?.createdAt || "");
        if (!createdAt) return true;
        return !knownCreatedAt.has(createdAt) && !currentRunDates.has(createdAt);
      });
      for (const item of newItems) {
        const createdAt = String((item as Record<string, unknown>)?.createdAt || "");
        if (createdAt) currentRunDates.add(createdAt);
      }
      all.push(...newItems);
      if (expectedNewItems > 0 && all.length >= expectedNewItems) break;
      if (newItems.length === 0) break;
    } else {
      all.push(...page);
    }

    if (guard === 1 || guard % 5 === 0) {
      onProgress?.(`${config.sheetName}: Loading page ${guard} (${all.length} records so far)...`);
    }

    if (page.length < config.pageSize) break;

    if (config.pagination === "cursor") {
      const last = page[page.length - 1] as Record<string, unknown>;
      const next = config.getNextCursor?.(last as { createdAt: string }) ?? null;
      if (!next || next === pointer) break;
      pointer = next;
      continue;
    }

    pointer += config.pageSize;
  }

  return { records: all, totalCount };
}

// Returns the cache extras (pricingMode + currency) for a given key.
function cacheExtras(key: RewardKey, includeWalletFiat: boolean, currency: ExtraFiatCurrency) {
  const pricingMode = WALLET_TX_KEYS.has(key)
    ? ((includeWalletFiat ? "fiat-on" : "fiat-off") as "fiat-on" | "fiat-off")
    : undefined;
  return pricingMode
    ? { pricingMode, extraFiatCurrency: currency }
    : { extraFiatCurrency: currency };
}

// Fetches the current total record count for each key using a cheap limit=1 probe request.
async function fetchLiveCounts(
  accessToken: string,
  keys: RewardKey[],
): Promise<Record<string, number | null>> {
  const headers = buildApiHeaders(accessToken);
  const configs = keys.map((k) => REWARD_CONFIG_MAP[k]).filter(Boolean) as RewardConfig[];

  const entries = await Promise.all(
    configs.map(async (config) => {
      const initial = config.pagination === "cursor" ? Date.now() : 0;
      const probeBody: RewardRequestBody = { ...config.buildBody(initial) };
      if (probeBody.pagination) {
        probeBody.pagination = { ...probeBody.pagination, limit: 1 };
      } else if (probeBody.limit !== undefined) {
        probeBody.limit = 1;
      }
      try {
        const payload = await postJson<GoMiningApiResponse>(config.apiUrl, headers, probeBody);
        return [config.key, payload?.data?.count ?? null] as const;
      } catch {
        return [config.key, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

// Merges incoming records into existing ones, deduplicating by createdAt and sorting newest first.
function mergeRecords(existing: RewardRecord[], incoming: RewardRecord[]): RewardRecord[] {
  const seen = new Set<string>();
  const merged: RewardRecord[] = [];

  for (const item of [...incoming, ...existing]) {
    const createdAt = typeof item?.createdAt === "string" ? item.createdAt : "";
    if (!createdAt) {
      merged.push(item);
      continue;
    }
    if (seen.has(createdAt)) continue;
    seen.add(createdAt);
    merged.push(item);
  }

  return merged.sort(
    (a, b) =>
      new Date(String(b?.createdAt || 0)).getTime() - new Date(String(a?.createdAt || 0)).getTime(),
  );
}

export interface ExportFlowParams {
  accessToken: string;
  selectedKeys: RewardKey[];
  cache: CacheState;
  includeWalletFiat: boolean;
  includeExcelFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
  txFromTypeFilter?: string[];
  onMessage: (msg: string) => void;
  onCacheUpdate: (cache: CacheState) => void;
}

// Orchestrates the full export: probe → fetch → enrich → build Excel → download.
export async function executeExportFlow({
  accessToken,
  selectedKeys,
  cache,
  includeWalletFiat,
  includeExcelFiat,
  excelFiatCurrency,
  txFromTypeFilter,
  onMessage,
  onCacheUpdate,
}: ExportFlowParams): Promise<string> {
  await checkExportRateLimit(accessToken);

  try {
    const cachedKeys = selectedKeys.filter((k) => cache[k]);
    const uncachedKeys = selectedKeys.filter((k) => !cache[k]);

    let updatedCache: CacheState = { ...cache };
    let staleKeys: RewardKey[] = [];
    const incrementalKeys = new Set<RewardKey>();
    const currencyChangeKeys = new Set<RewardKey>();

    if (cachedKeys.length > 0) {
      onMessage(`Checking ${cachedKeys.length} cached sheet(s) for updates...`);
      const counts = await fetchLiveCounts(accessToken, cachedKeys);

      staleKeys = cachedKeys.filter((k) => {
        const entry = updatedCache[k];
        if (!entry) return true;

        if (WALLET_TX_KEYS.has(k)) {
          const desiredMode = includeWalletFiat ? "fiat-on" : "fiat-off";
          if ((entry.pricingMode || "fiat-on") !== desiredMode) return true;
          if (hasMissingPrices(entry, k, includeWalletFiat)) return true;
        }

        const liveCount = counts[k];
        if (liveCount == null) return true;
        if (liveCount > entry.totalCount) {
          incrementalKeys.add(k);
          return true;
        }
        if (liveCount !== entry.totalCount) return true;

        // Count matches — if only the currency changed, re-enrich in place (no GoMining fetch).
        if (entry.extraFiatCurrency !== excelFiatCurrency) currencyChangeKeys.add(k);
        return false;
      });
    }

    const order = Object.fromEntries(ALL_REWARD_KEYS.map((k, i) => [k, i]));
    const keysToFetch = [...uncachedKeys, ...staleKeys].sort(
      (a, b) => (order[a] ?? 999) - (order[b] ?? 999),
    );

    const priceCache = getSessionPriceCache();

    // Phase 1: Fetch all raw records from GoMining API before any CoinGecko work,
    // so the auth token is not at risk of expiring during long enrichment waits.
    type RawFetch = {
      config: RewardConfig;
      rawRecords: unknown[];
      totalCount: number | null;
      useIncremental: boolean;
    };
    const fetched: RawFetch[] = [];

    for (let i = 0; i < keysToFetch.length; i++) {
      const key = keysToFetch[i];
      const config = REWARD_CONFIG_MAP[key];
      if (!config) continue;

      onMessage(`Fetching ${config.sheetName} (${i + 1} of ${keysToFetch.length})...`);

      const currentEntry = updatedCache[key];
      const useIncremental = Boolean(currentEntry && incrementalKeys.has(key));
      const incrementalOptions: IncrementalFetchOptions | undefined =
        useIncremental && currentEntry
          ? {
              knownCreatedAt: currentEntry.records
                .map((r) => (typeof r?.createdAt === "string" ? r.createdAt : ""))
                .filter(Boolean),
              knownTotalCount: currentEntry.totalCount,
            }
          : undefined;

      const { records: rawRecords, totalCount } = await fetchAllPages(
        config,
        accessToken,
        incrementalOptions,
        onMessage,
      );
      fetched.push({ config, rawRecords, totalCount, useIncremental });
    }

    // Phase 1.5: Re-enrich currency-change-only keys using existing cached USD values.
    // Count is unchanged so no GoMining fetch is needed — just recompute fiat fields.
    for (const key of currencyChangeKeys) {
      const currentEntry = updatedCache[key];
      if (!currentEntry) continue;
      const config = REWARD_CONFIG_MAP[key];
      if (!config) continue;

      onMessage(`Applying ${excelFiatCurrency} rates to ${config.sheetName}...`);
      const reEnriched = await reenrichFiatValues(config, currentEntry.records, excelFiatCurrency);
      const extras = cacheExtras(key, includeWalletFiat, excelFiatCurrency);

      saveCacheEntry(key, currentEntry.sheetName, reEnriched, currentEntry.totalCount, extras);
      persistPriceCache(key, reEnriched);

      updatedCache = {
        ...updatedCache,
        [key]: { ...currentEntry, records: reEnriched, fetchedAt: Date.now(), ...extras },
      };
      onCacheUpdate(updatedCache);
    }

    // Phase 2: Enrich all fetched records (CoinGecko + EUR rates).
    for (let i = 0; i < fetched.length; i++) {
      const { config, rawRecords, totalCount, useIncremental } = fetched[i];
      const key = config.key;

      onMessage(`Enriching ${config.sheetName} (${i + 1} of ${fetched.length})...`);
      const enriched = await enrichRecords(
        config,
        rawRecords,
        priceCache,
        includeWalletFiat,
        excelFiatCurrency,
        onMessage,
      );
      const prepared = filterCacheableRecords(key, enriched as RewardRecord[], totalCount ?? 0);

      if (prepared.removedCreated > 0) {
        onMessage(
          `${config.sheetName}: Skipped ${prepared.removedCreated} pending reinvestment ${prepared.removedCreated === 1 ? "entry" : "entries"}, will retry on next export.`,
        );
      }

      const extras = cacheExtras(key, includeWalletFiat, excelFiatCurrency);
      const currentEntry = updatedCache[key];
      const recordsForCache =
        useIncremental && currentEntry
          ? mergeRecords(currentEntry.records, prepared.records)
          : prepared.records;
      const totalCountForCache =
        typeof totalCount === "number"
          ? totalCount
          : useIncremental && currentEntry
            ? currentEntry.totalCount
            : prepared.totalCount;

      saveCacheEntry(key, config.sheetName, recordsForCache, totalCountForCache, extras);
      persistPriceCache(key, recordsForCache);

      updatedCache = {
        ...updatedCache,
        [key]: {
          sheetName: config.sheetName,
          records: recordsForCache,
          totalCount: totalCountForCache,
          fetchedAt: Date.now(),
          ...extras,
        },
      };
      onCacheUpdate(updatedCache);
    }

    onMessage("Building Excel file...");
    const sheetsPayload: RewardSheetPayload[] = selectedKeys.flatMap((key) => {
      const cached = updatedCache[key];
      if (!cached) return [];
      const config = REWARD_CONFIG_MAP[key];
      let records = cached.records as RewardSheetPayload["records"];
      if (key === "transactions" && txFromTypeFilter && txFromTypeFilter.length > 0) {
        records = records.filter((r) =>
          txFromTypeFilter.includes((r as { fromType?: string }).fromType ?? ""),
        );
      }
      return [
        {
          key,
          sheetName: cached.sheetName,
          sheetType: config?.sheetType ?? "standard",
          records,
          totalCount: cached.totalCount,
        } as RewardSheetPayload,
      ];
    });

    const options: FetchRewardsOptions = {
      walletTx: { includeFiat: includeWalletFiat },
      excel: { includeFiat: includeExcelFiat, fiatCurrency: excelFiatCurrency },
    };

    const buffer = await buildExcelFromSheets(sheetsPayload, options);
    triggerFileDownload(buffer, `rewards-${new Date().toISOString().slice(0, 10)}.xlsx`);

    const freshCount = cachedKeys.length - staleKeys.length - currencyChangeKeys.size;
    const parts: string[] = [];
    if (uncachedKeys.length > 0) parts.push(`${uncachedKeys.length} fetched`);
    if (staleKeys.length > 0) parts.push(`${staleKeys.length} updated`);
    if (currencyChangeKeys.size > 0) parts.push(`${currencyChangeKeys.size} re-enriched`);
    if (freshCount > 0) parts.push(`${freshCount} from cache`);
    return `Excel file downloaded! (${parts.join(", ") || "all from cache"})`;
  } catch (err) {
    await rollbackExportRateLimit(accessToken);
    throw err;
  }
}
