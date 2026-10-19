import i18n from "@/i18n";
import { buildApiHeaders, postJson } from "@/lib/http";
import type {
  CursorPaginationItem,
  GoMiningApiResponse,
  RewardConfig,
  RewardRecord,
} from "@/types/rewards";
import { latestRecordEpoch, toEpoch } from "./date-utils";
import { fetchWithRetry } from "./fetch-with-retry";
import { buildRequestBody } from "./pagination";

function simpleEarnCachedKey(record: RewardRecord): string | null {
  const createdAt = typeof record?.createdAt === "string" ? record.createdAt : "";
  const asset = typeof record?.asset === "string" ? record.asset : "";
  const rewardInUsd = Number(record?.rewardInUSD ?? record?.rewardInUsd ?? 0);
  if (!createdAt || !asset) return null;
  return `${createdAt}|${asset}|${rewardInUsd}`;
}

/**
 * One "createdAt|asset|usd" key per asset of a raw payout, matching simpleEarnCachedKey (wei
 * converted to USD).
 */
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

/**
 * Fetches only new Simple Earn payouts, newest first, stopping at the first page touching cached data.
 * Records already cached are detected by timestamp boundary or by their createdAt|asset|usd key.
 */
export async function fetchSimpleEarnIncremental(
  config: RewardConfig,
  accessToken: string,
  existingRecords: RewardRecord[],
  onProgress?: (message: string) => void,
  displayName?: string,
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
        i18n.t("export.loadingPageNew", {
          name: displayName ?? config.sheetName,
          page: guard,
          count: all.length,
        }),
      );
    }

    if (hasKnownInPage) break;
    if (page.length < config.pageSize) break;

    const last = page[page.length - 1] as CursorPaginationItem;
    const next = config.getNextCursor?.(last) ?? "";
    if (!next || next === pointer) break;
    pointer = next;
  }

  return { records: all, totalCount };
}
