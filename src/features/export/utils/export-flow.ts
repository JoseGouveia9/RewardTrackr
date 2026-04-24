import { WALLET_TX_KEYS } from "../config/wallet-types";
import { REWARD_CONFIG_MAP, ALL_REWARD_KEYS } from "../config/reward-configs";
import { buildApiHeaders, postJson } from "@/lib/http";
import { enrichRecords, reenrichFiatValues } from "./transformers";
import { getSessionPriceCache } from "../api/coingecko";
import { buildExcelFromSheets } from "./excel-builder";
import type {
  CacheState,
  CursorPaginationItem,
  ExtraFiatCurrency,
  FetchRewardsOptions,
  GoMiningApiResponse,
  IncrementalFetchOptions,
  RewardConfig,
  RewardKey,
  RewardRecord,
  RewardRequestBody,
  RewardSheetPayload,
} from "../types";
import {
  MINING_SCHEMA_VERSION,
  hasMissingPrices,
  filterCacheableRecords,
  persistPriceCache,
  saveCacheEntry,
} from "./cache";

const WORKER_URL =
  (import.meta.env.VITE_WORKER_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 60_000;

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
  }).catch(() => {});
}

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

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  onProgress?: (msg: string) => void,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Only retry on AbortError (request timeout) — API/network errors are not retried
      const isTimeout = err instanceof Error && err.name === "AbortError";
      if (!isTimeout || attempt > MAX_RETRIES) throw err;
      onProgress?.(`Request timed out. Retrying in 60s... (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  throw new Error("Max retries exceeded");
}

function getInitialPointer(config: RewardConfig): number | string {
  switch (config.pagination) {
    case "cursor":
      return Date.now();
    case "date-cursor":
      return new Date().toISOString();
    case "skip":
    default:
      return 0;
  }
}

function buildRequestBody(config: RewardConfig, pointer: number | string): RewardRequestBody {
  switch (config.pagination) {
    case "cursor":
      return config.buildBody(typeof pointer === "number" ? pointer : Date.now());
    case "date-cursor":
      return config.buildBody(
        typeof pointer === "string" ? pointer : new Date(pointer || Date.now()).toISOString(),
      );
    case "skip":
    default:
      return config.buildBody(typeof pointer === "number" ? pointer : 0);
  }
}

async function fetchAllPages(
  config: RewardConfig,
  accessToken: string,
  incremental?: IncrementalFetchOptions,
  onProgress?: (msg: string) => void,
): Promise<{ records: unknown[]; totalCount: number | null }> {
  const headers = buildApiHeaders(accessToken);
  const all: unknown[] = [];
  let pointer: number | string = getInitialPointer(config);
  let guard = 0;
  let totalCount: number | null = null;

  const knownCreatedAt = new Set(
    incremental?.knownCreatedAt?.filter((v): v is string => typeof v === "string") ?? [],
  );
  // Tracks dates seen in this run so newly-fetched items aren't mistaken for "already known"
  const currentRunDates = new Set<string>();
  const knownTotalCount =
    typeof incremental?.knownTotalCount === "number" ? incremental.knownTotalCount : null;
  const incrementalMode = knownCreatedAt.size > 0;
  let expectedNewItems = 0;

  while (guard < 1000) {
    guard += 1;
    const payload = await fetchWithRetry(
      () =>
        postJson<GoMiningApiResponse>(config.apiUrl, headers, buildRequestBody(config, pointer)),
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

    if (config.pagination === "date-cursor") {
      const last = page[page.length - 1] as Record<string, unknown>;
      const next = config.getNextCursor(last as CursorPaginationItem);
      if (!next || next === pointer) break;
      pointer = next;
      continue;
    }

    pointer = (pointer as number) + config.pageSize;
  }

  return { records: all, totalCount };
}

function cacheExtras(key: RewardKey, includeWalletFiat: boolean, currency: ExtraFiatCurrency) {
  const pricingMode = WALLET_TX_KEYS.has(key)
    ? ((includeWalletFiat ? "fiat-on" : "fiat-off") as "fiat-on" | "fiat-off")
    : undefined;
  const schemaVersion = MINING_SCHEMA_VERSION;
  return pricingMode
    ? { pricingMode, extraFiatCurrency: currency, schemaVersion }
    : { extraFiatCurrency: currency, schemaVersion };
}

function toEpoch(createdAt: string | undefined | null): number {
  if (!createdAt) return Number.NaN;
  // GoMining dates use non-standard formats: space instead of T, sub-ms precision, "+00" suffix
  const normalized = createdAt
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/\s*\+00(?::?00)?$/, "Z");
  return new Date(normalized).getTime();
}

function simpleEarnCachedKey(record: RewardRecord): string | null {
  const createdAt = typeof record?.createdAt === "string" ? record.createdAt : "";
  const asset = typeof record?.asset === "string" ? record.asset : "";
  const rewardInUsd = Number(record?.rewardInUSD ?? record?.rewardInUsd ?? 0);
  if (!createdAt || !asset) return null;
  return `${createdAt}|${asset}|${rewardInUsd}`;
}

function simpleEarnRawKeys(raw: unknown): string[] {
  const item = raw as Record<string, unknown>;
  const createdAt = typeof item?.createdAt === "string" ? item.createdAt : "";
  const assets = Array.isArray(item?.assets) ? (item.assets as Array<Record<string, unknown>>) : [];
  if (!createdAt || assets.length === 0) return [];
  return assets
    .map((asset) => {
      const assetName = typeof asset?.asset === "string" ? asset.asset : "";
      const rewardInUsd = Number(asset?.rewardInUsd ?? 0) / 1e18;
      if (!assetName) return "";
      return `${createdAt}|${assetName}|${rewardInUsd}`;
    })
    .filter(Boolean);
}

async function fetchSimpleEarnIncremental(
  config: RewardConfig,
  accessToken: string,
  existingRecords: RewardRecord[],
  onProgress?: (msg: string) => void,
): Promise<{ records: unknown[]; totalCount: number | null }> {
  const headers = buildApiHeaders(accessToken);
  const cachedLatestEpoch = latestRecordEpoch(existingRecords);
  const knownKeys = new Set(
    existingRecords
      .map((record) => simpleEarnCachedKey(record))
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  const all: unknown[] = [];
  let totalCount: number | null = null;
  let pointer: string | number = new Date().toISOString();
  let guard = 0;

  while (guard < 1000) {
    guard += 1;
    const payload = await fetchWithRetry(
      () =>
        postJson<GoMiningApiResponse>(config.apiUrl, headers, buildRequestBody(config, pointer)),
      onProgress,
    );

    if (totalCount === null && payload?.data?.count !== undefined) {
      totalCount = payload.data.count ?? null;
    }

    const page = Array.isArray(payload?.data?.array) ? payload.data.array : [];
    if (page.length === 0) break;

    let hasKnownInPage = false;
    const pageNewItems: unknown[] = [];

    for (let index = 0; index < page.length; index++) {
      const raw = page[index];
      const keys = simpleEarnRawKeys(raw);
      const rawItem = raw as Record<string, unknown>;
      const itemCreatedAt = typeof rawItem?.createdAt === "string" ? rawItem.createdAt : null;
      const itemEpoch = toEpoch(itemCreatedAt);

      const reachedCachedBoundary =
        Number.isFinite(itemEpoch) &&
        Number.isFinite(cachedLatestEpoch) &&
        itemEpoch <= cachedLatestEpoch;
      if (reachedCachedBoundary) {
        hasKnownInPage = true;
        continue;
      }

      if (keys.length === 0) {
        pageNewItems.push(raw);
        continue;
      }

      const hasUnseen = keys.some((key) => !knownKeys.has(key));
      if (hasUnseen) {
        pageNewItems.push(raw);
        for (const key of keys) knownKeys.add(key);
      } else {
        hasKnownInPage = true;
      }
    }

    all.push(...pageNewItems);

    if (guard === 1 || guard % 5 === 0) {
      onProgress?.(
        `${config.sheetName}: Loading page ${guard} (${all.length} new records so far)...`,
      );
    }

    if (hasKnownInPage) break;
    if (page.length < config.pageSize) break;

    const last = page[page.length - 1] as Record<string, unknown>;
    const next = config.getNextCursor?.(last as CursorPaginationItem) ?? "";
    if (!next || next === pointer) break;
    pointer = next;
  }

  return { records: all, totalCount };
}

function latestRecordEpoch(records: RewardRecord[]): number {
  let latest = Number.NaN;
  for (const record of records) {
    const epoch = toEpoch(typeof record?.createdAt === "string" ? record.createdAt : null);
    if (!Number.isFinite(epoch)) continue;
    if (!Number.isFinite(latest) || epoch > latest) latest = epoch;
  }
  return latest;
}

type LiveProbe = {
  count: number | null;
  latestCreatedAt: string | null;
};

type CacheFreshnessDecision = {
  isStale: boolean;
  useIncremental: boolean;
  currencyChanged: boolean;
};

async function fetchLiveCounts(
  accessToken: string,
  keys: RewardKey[],
): Promise<Record<string, LiveProbe>> {
  const headers = buildApiHeaders(accessToken);
  const configs: RewardConfig[] = keys.reduce<RewardConfig[]>((acc, key) => {
    const config = REWARD_CONFIG_MAP[key];
    if (config) acc.push(config);
    return acc;
  }, []);

  const entries = await Promise.all(
    configs.map(async (config) => {
      const probeBody: RewardRequestBody = {
        ...buildRequestBody(config, getInitialPointer(config)),
      };
      if (probeBody.pagination) {
        probeBody.pagination = { ...probeBody.pagination, limit: 1 };
      } else if (probeBody.limit !== undefined) {
        probeBody.limit = 1;
      }
      try {
        const payload = await postJson<GoMiningApiResponse>(config.apiUrl, headers, probeBody);
        const first = Array.isArray(payload?.data?.array)
          ? (payload.data.array[0] as Record<string, unknown> | undefined)
          : undefined;
        const latestCreatedAt = typeof first?.createdAt === "string" ? first.createdAt : null;
        return [config.key, { count: payload?.data?.count ?? null, latestCreatedAt }] as const;
      } catch {
        return [config.key, { count: null, latestCreatedAt: null }] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function evaluateCacheFreshness(
  key: RewardKey,
  entry: CacheState[RewardKey],
  config: RewardConfig,
  liveProbe: LiveProbe | undefined,
  includeWalletFiat: boolean,
  excelFiatCurrency: ExtraFiatCurrency,
): CacheFreshnessDecision {
  if (!entry) {
    return { isStale: true, useIncremental: false, currencyChanged: false };
  }

  if (WALLET_TX_KEYS.has(key)) {
    const desiredMode = includeWalletFiat ? "fiat-on" : "fiat-off";
    if ((entry.pricingMode || "fiat-on") !== desiredMode) {
      return { isStale: true, useIncremental: false, currencyChanged: false };
    }
    if (hasMissingPrices(entry, key, includeWalletFiat)) {
      return { isStale: true, useIncremental: false, currencyChanged: false };
    }
  }

  const liveCount = liveProbe?.count ?? null;

  if (config.key === "simple-earn") {
    const hasLiveLatest = typeof liveProbe?.latestCreatedAt === "string";
    const liveCountReliable = liveCount != null && (liveCount > 0 || !hasLiveLatest);

    if (liveCountReliable) {
      if (liveCount > entry.totalCount) {
        return { isStale: true, useIncremental: true, currencyChanged: false };
      }
      if (liveCount !== entry.totalCount) {
        return { isStale: true, useIncremental: false, currencyChanged: false };
      }
    }

    const liveLatestEpoch = toEpoch(liveProbe?.latestCreatedAt);
    const cachedLatestEpoch = latestRecordEpoch(entry.records);

    if (
      Number.isFinite(liveLatestEpoch) &&
      Number.isFinite(cachedLatestEpoch) &&
      liveLatestEpoch > cachedLatestEpoch
    ) {
      return { isStale: true, useIncremental: true, currencyChanged: false };
    }

    if (
      !liveCountReliable &&
      (!Number.isFinite(liveLatestEpoch) || !Number.isFinite(cachedLatestEpoch))
    ) {
      return { isStale: true, useIncremental: true, currencyChanged: false };
    }
  } else {
    if (liveCount == null) {
      return { isStale: true, useIncremental: false, currencyChanged: false };
    }
    if (liveCount > entry.totalCount) {
      return { isStale: true, useIncremental: true, currencyChanged: false };
    }
    if (liveCount !== entry.totalCount) {
      return { isStale: true, useIncremental: false, currencyChanged: false };
    }
  }

  const currencyChanged = entry.extraFiatCurrency !== excelFiatCurrency;
  return { isStale: false, useIncremental: false, currencyChanged };
}

function mergeRecords(existing: RewardRecord[], incoming: RewardRecord[]): RewardRecord[] {
  const seen = new Set<string>();
  const merged: RewardRecord[] = [];

  const dedupeKey = (item: RewardRecord): string | null => {
    const createdAt = typeof item?.createdAt === "string" ? item.createdAt : "";
    if (!createdAt) return null;

    const currency = typeof item?.currency === "string" ? item.currency : "";
    const asset = typeof item?.asset === "string" ? item.asset : "";
    const type = typeof item?.type === "string" ? item.type : "";
    const txType = typeof item?.txType === "string" ? item.txType : "";
    const fromType = typeof item?.fromType === "string" ? item.fromType : "";
    const reward = typeof item?.reward === "number" ? String(item.reward) : "";

    return [createdAt, currency, asset, type, txType, fromType, reward].join("|");
  };

  // incoming first so newer records win when the same key appears in both
  for (const item of [...incoming, ...existing]) {
    const key = dedupeKey(item);
    if (!key) {
      merged.push(item);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
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
  onStarted?: () => void;
}

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
  onStarted,
}: ExportFlowParams): Promise<string> {
  await checkExportRateLimit(accessToken);
  onStarted?.();

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
        const config = REWARD_CONFIG_MAP[k];
        if (!config) return true;
        const decision = evaluateCacheFreshness(
          k,
          entry,
          config,
          counts[k],
          includeWalletFiat,
          excelFiatCurrency,
        );

        if (decision.useIncremental) incrementalKeys.add(k);
        if (decision.currencyChanged) currencyChangeKeys.add(k);
        return decision.isStale;
      });
    }

    const order = Object.fromEntries(ALL_REWARD_KEYS.map((k, i) => [k, i]));
    const keysToFetch = [...uncachedKeys, ...staleKeys].sort(
      (a, b) => (order[a] ?? 999) - (order[b] ?? 999),
    );

    const priceCache = getSessionPriceCache();

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

      const { records: rawRecords, totalCount } =
        key === "simple-earn" && useIncremental && currentEntry
          ? await fetchSimpleEarnIncremental(config, accessToken, currentEntry.records, onMessage)
          : await fetchAllPages(config, accessToken, incrementalOptions, onMessage);
      fetched.push({ config, rawRecords, totalCount, useIncremental });
    }

    for (const key of currencyChangeKeys) {
      const currentEntry = updatedCache[key];
      if (!currentEntry) continue;
      const config = REWARD_CONFIG_MAP[key];
      if (!config) continue;

      onMessage(`Applying ${excelFiatCurrency} rates to ${config.sheetName}...`);
      const reEnriched = await reenrichFiatValues(config, currentEntry.records, excelFiatCurrency);
      const extras = {
        ...cacheExtras(key, includeWalletFiat, excelFiatCurrency),
        newEntriesCount: 0,
      };

      saveCacheEntry(key, currentEntry.sheetName, reEnriched, currentEntry.totalCount, extras);
      persistPriceCache(key, reEnriched);

      updatedCache = {
        ...updatedCache,
        [key]: { ...currentEntry, records: reEnriched, fetchedAt: Date.now(), ...extras },
      };
      onCacheUpdate(updatedCache);
    }

    // wallet-tx enrichment makes slow, rate-limited CoinGecko calls — process last to not block others
    const fetchedOrdered = [
      ...fetched.filter((f) => f.config.enrichType !== "wallet-tx-coingecko"),
      ...fetched.filter((f) => f.config.enrichType === "wallet-tx-coingecko"),
    ];
    for (let i = 0; i < fetchedOrdered.length; i++) {
      const { config, rawRecords, totalCount, useIncremental } = fetchedOrdered[i];
      const key = config.key;

      onMessage(`Enriching ${config.sheetName} (${i + 1} of ${fetchedOrdered.length})...`);
      const enriched = await enrichRecords(
        config,
        rawRecords,
        priceCache,
        includeWalletFiat,
        excelFiatCurrency,
        onMessage,
      );
      const fallbackTotalCount =
        typeof totalCount === "number" ? totalCount : (enriched as RewardRecord[]).length;
      const prepared = filterCacheableRecords(key, enriched as RewardRecord[], fallbackTotalCount);

      if (prepared.removedCreated > 0) {
        onMessage(
          `${config.sheetName}: Skipped ${prepared.removedCreated} pending reinvestment ${prepared.removedCreated === 1 ? "entry" : "entries"}, will retry on next export.`,
        );
      }

      const currentEntry = updatedCache[key];
      const recordsForCache =
        useIncremental && currentEntry
          ? mergeRecords(currentEntry.records, prepared.records)
          : prepared.records;
      const previousCount = currentEntry?.records.length ?? 0;
      const newEntriesCount = !currentEntry
        ? recordsForCache.length
        : Math.max(0, recordsForCache.length - previousCount);
      const extras = {
        ...cacheExtras(key, includeWalletFiat, excelFiatCurrency),
        newEntriesCount,
      };
      const hasApiTotalCount =
        typeof totalCount === "number" && (totalCount > 0 || prepared.records.length === 0);
      const totalCountForCache = hasApiTotalCount ? totalCount : recordsForCache.length;

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
