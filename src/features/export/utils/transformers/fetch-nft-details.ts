import { buildApiHeaders, postJson, resolveApiBase } from "@/lib/http";
import type { GoMiningApiResponse, SoloMiningNftDetailRecord } from "@/types/rewards";

const DETAILS_PAGE_SIZE = 50;
const MAX_DETAILS_PAGES = 20;

// Used when a historical day's list record lacks farm statistics.
export async function fetchSoloMiningNftDetails(
  nftIncomeStatisticId: number,
  accessToken: string,
): Promise<SoloMiningNftDetailRecord[]> {
  const headers = buildApiHeaders(accessToken);
  const url = `${resolveApiBase()}/api/nft-income/details`;
  const all: SoloMiningNftDetailRecord[] = [];
  let cursor: number | string | null = null;

  for (let page = 0; page < MAX_DETAILS_PAGES; page++) {
    const body: Record<string, unknown> = { nftIncomeStatisticId, limit: DETAILS_PAGE_SIZE };
    if (cursor != null) body.cursor = cursor;
    const payload = await postJson<GoMiningApiResponse<SoloMiningNftDetailRecord>>(
      url,
      headers,
      body,
    );
    const items = payload?.data?.items ?? [];
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    const next = payload?.data?.nextCursor ?? null;
    if (next == null || items.length < DETAILS_PAGE_SIZE) break;
    cursor = next;
  }

  return all;
}
