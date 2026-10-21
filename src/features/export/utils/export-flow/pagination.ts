import i18n from "@/i18n";
import { buildApiHeaders, postJson } from "@/lib/http";
import type {
  CursorPaginationItem,
  GoMiningApiResponse,
  IncrementalFetchOptions,
  RewardConfig,
  RewardRequestBody,
} from "@/types/rewards";
import { fetchWithRetry } from "./fetch-with-retry";

const MAX_PAGES = 1000;

/**
 * Starting cursor per pagination style: now (ms), now (ISO), 0, or null for list-cursor (the
 * server returns the first cursor to continue with). Paging walks backwards in time.
 */
export function getInitialPointer(config: RewardConfig): number | string | null {
  switch (config.pagination) {
    case "cursor":
      return Date.now();
    case "date-cursor":
      return new Date().toISOString();
    case "list-cursor":
      return null;
    case "skip":
    default:
      return 0;
  }
}

/**
 * Builds the next page's request body per pagination style. list-cursor's cursor is an opaque
 * server token, so it's passed through untouched instead of being coerced by JS type.
 */
export function buildRequestBody(
  config: RewardConfig,
  pointer: number | string | null,
): RewardRequestBody {
  switch (config.pagination) {
    case "cursor":
      return config.buildBody(typeof pointer === "number" ? pointer : Date.now());
    case "date-cursor":
      return config.buildBody(
        typeof pointer === "string" ? pointer : new Date(pointer || Date.now()).toISOString(),
      );
    case "list-cursor":
      return config.buildBody(pointer as number | string | null);
    case "skip":
    default:
      return config.buildBody(typeof pointer === "number" ? pointer : 0);
  }
}

function createdAtOf(item: unknown): string {
  return String((item as Record<string, unknown>)?.createdAt || "");
}

/**
 * Pages through the API until exhausted; in incremental mode stops once a page hits already-known dates.
 * Dates seen in the current run are tracked so fresh items aren't mistaken for known ones.
 */
export async function fetchAllPages(
  config: RewardConfig,
  accessToken: string,
  incremental?: IncrementalFetchOptions,
  onProgress?: (message: string) => void,
  displayName?: string,
): Promise<{ records: unknown[]; totalCount: number | null }> {
  const headers = buildApiHeaders(accessToken);
  const all: unknown[] = [];
  let pointer: number | string | null = getInitialPointer(config);
  let guard = 0;
  let totalCount: number | null = null;

  const knownCreatedAt = new Set(
    incremental?.knownCreatedAt?.filter((value): value is string => typeof value === "string") ??
      [],
  );
  const currentRunDates = new Set<string>();
  const knownTotalCount =
    typeof incremental?.knownTotalCount === "number" ? incremental.knownTotalCount : null;
  const incrementalMode = knownCreatedAt.size > 0;
  let expectedNewItems = 0;

  while (guard < MAX_PAGES) {
    guard += 1;
    const payload = await fetchWithRetry(
      () =>
        postJson<GoMiningApiResponse>(config.apiUrl, headers, buildRequestBody(config, pointer)),
      onProgress,
    );
    const page = payload?.data?.array || payload?.data?.items || [];

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
        const createdAt = createdAtOf(item);
        if (!createdAt) return true;
        return !knownCreatedAt.has(createdAt) && !currentRunDates.has(createdAt);
      });
      for (const item of newItems) {
        const createdAt = createdAtOf(item);
        if (createdAt) currentRunDates.add(createdAt);
      }
      all.push(...newItems);
      if (expectedNewItems > 0 && all.length >= expectedNewItems) break;
      if (newItems.length === 0) break;
    } else {
      all.push(...page);
    }

    if (guard === 1 || guard % 5 === 0) {
      onProgress?.(
        i18n.t("export.loadingPage", {
          name: displayName ?? config.sheetName,
          page: guard,
          count: all.length,
        }),
      );
    }

    if (page.length < config.pageSize) break;

    let nextPointer: number | string | null = null;
    if (config.pagination === "cursor" || config.pagination === "date-cursor") {
      const last = page[page.length - 1] as CursorPaginationItem;
      const next = config.getNextCursor?.(last) ?? null;
      if (next && next !== pointer) nextPointer = next;
    } else if (config.pagination === "list-cursor") {
      nextPointer = payload?.data?.nextCursor ?? null;
    } else {
      nextPointer = (pointer as number) + config.pageSize;
    }

    if (nextPointer === null) break;
    pointer = nextPointer;
  }

  return { records: all, totalCount };
}
