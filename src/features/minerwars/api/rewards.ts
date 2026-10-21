import { postJson } from "@/lib/http";
import { API } from "./base";

type TransactionHistoryResponse = {
  data: { array: Array<{ createdAt: string; valueNumeric?: string }> };
};

/**
 * Returns null when no matching transaction exists yet (payout not posted), so callers can
 * fall back to the league-based estimate.
 */
export async function getPersonalMinerWarsRewardTransactionSum(
  headers: Record<string, string>,
  fromDateString: string,
  toDateString: string,
): Promise<number | null> {
  const sums = await getPersonalMinerWarsRewardTransactionSumsForWindows(headers, [
    { key: 0, fromDateString, toDateString },
  ]);
  return sums.get(0) ?? null;
}

/**
 * Walks the wallet tx history once and buckets rows into every window, instead of one
 * walk-back per window.
 */
export async function getPersonalMinerWarsRewardTransactionSumsForWindows(
  headers: Record<string, string>,
  windows: Array<{ key: number; fromDateString: string; toDateString: string }>,
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  if (windows.length === 0) return result;
  const parsed = windows.map((rewardWindow) => ({
    key: rewardWindow.key,
    fromMilliseconds: new Date(`${rewardWindow.fromDateString}T00:00:00.000Z`).getTime(),
    toMilliseconds: new Date(`${rewardWindow.toDateString}T00:00:00.000Z`).getTime(),
  }));
  const earliestFromMilliseconds = Math.min(
    ...parsed.map((rewardWindow) => rewardWindow.fromMilliseconds),
  );
  const sums = new Map<number, number>();
  const found = new Map<number, boolean>();

  const limit = 100;
  let cursor = Date.now();
  while (true) {
    const response = await postJson<TransactionHistoryResponse>(
      `${API}/api/wallet/transaction-history`,
      headers,
      {
        filter: { walletType: ["VIRTUAL_GMT"], fromType: ["gmt-fund"], range: null },
        pagination: { cursor, limit },
      },
    );
    const array = response.data.array ?? [];
    if (array.length === 0) break;
    let pastEarliest = false;
    for (const row of array) {
      const timestamp = new Date(row.createdAt).getTime();
      for (const rewardWindow of parsed) {
        if (timestamp >= rewardWindow.fromMilliseconds && timestamp < rewardWindow.toMilliseconds) {
          sums.set(
            rewardWindow.key,
            (sums.get(rewardWindow.key) ?? 0) + parseFloat(row.valueNumeric || "0") / 1e18,
          );
          found.set(rewardWindow.key, true);
        }
      }
      if (timestamp < earliestFromMilliseconds) pastEarliest = true;
    }
    if (pastEarliest) break;
    cursor = new Date(array[array.length - 1].createdAt).getTime();
  }

  for (const rewardWindow of parsed) {
    result.set(
      rewardWindow.key,
      found.get(rewardWindow.key) ? (sums.get(rewardWindow.key) ?? 0) : null,
    );
  }
  return result;
}

/** GMT reward = the user's blocksMined times the league's GMT fund per mined block. */
export async function getPersonalLeagueReward(
  headers: Record<string, string>,
  calculatedAt: string,
  leagueId: number,
): Promise<{ blocksMined: number; gmtRewards: number }> {
  const response = await postJson<{
    data: {
      gmtFund: number;
      totalMinedBlocks: number;
      me: { blocksMined: number } | null;
    };
  }>(`${API}/api/nft-game/user-leaderboard/index`, headers, {
    calculatedAt,
    leagueId,
    pagination: { skip: 0, limit: 1 },
  });
  const blocksMined = response.data.me?.blocksMined ?? 0;
  const gmtFund = response.data.gmtFund ?? 0;
  const totalMinedBlocks = response.data.totalMinedBlocks ?? 0;
  const gmtPerBlock = totalMinedBlocks > 0 ? gmtFund / totalMinedBlocks : 0;
  return { blocksMined, gmtRewards: blocksMined * gmtPerBlock };
}

export async function getBoostCostGmtForCycle(
  headers: Record<string, string>,
  cycleId: number,
): Promise<number> {
  const costs = await getBoostCostGmtForCycles(headers, [cycleId]);
  return costs.get(cycleId) ?? 0;
}

/** Walks the ability-payment history once and sums per cycleId. */
export async function getBoostCostGmtForCycles(
  headers: Record<string, string>,
  cycleIds: number[],
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (cycleIds.length === 0) return result;
  const idSet = new Set(cycleIds);
  for (const id of cycleIds) result.set(id, 0);
  const minCycleId = Math.min(...cycleIds);

  const limit = 40;
  let skip = 0;
  while (true) {
    const response = await postJson<{
      data: { count: number; array: Array<{ cycleId: number; valueInGmt: number }> };
    }>(`${API}/api/nft-game/nft-game-ability-payment/index`, headers, {
      pagination: { skip, limit },
    });
    const array = response.data.array ?? [];
    if (array.length === 0) break;
    for (const row of array) {
      if (idSet.has(row.cycleId))
        result.set(row.cycleId, (result.get(row.cycleId) ?? 0) + (row.valueInGmt ?? 0));
    }
    const count = response.data.count ?? 0;
    if (array.every((row) => row.cycleId < minCycleId) || skip + limit >= count) break;
    skip += limit;
  }
  return result;
}

/** `factor` multiplies maintenance cost; rewardDistributionDiscount is returned separately. */
export async function getDiscountFactor(
  headers: Record<string, string>,
): Promise<{ factor: number; gmtDiscount: number; rewardDistributionDiscount: number }> {
  const response = await postJson<{
    data: {
      dailyMaintenanceDiscount?: number;
      levelDiscount?: number;
      discountByMaintenanceInGmt?: number;
      rewardDistributionDiscount?: number;
    };
  }>(`${API}/api/user/get-my-nft-discount`, headers, {});
  const data = response.data ?? {};
  const gmtDiscount = data.discountByMaintenanceInGmt ?? 0;
  const rewardDistributionDiscount = data.rewardDistributionDiscount ?? 0;
  return {
    factor: 1 - ((data.dailyMaintenanceDiscount ?? 0) + (data.levelDiscount ?? 0) + gmtDiscount),
    gmtDiscount,
    rewardDistributionDiscount,
  };
}

/**
 * Dates with solo-mining income in the cycle. The last day's income is stored ~00:10 UTC the
 * next day, so the query window extends one day past the cycle end.
 */
export async function getSoloMiningDates(
  headers: Record<string, string>,
  cycleStartDate: string,
  cycleEndDate: string,
) {
  const endPlus1 = new Date(cycleEndDate);
  endPlus1.setUTCDate(endPlus1.getUTCDate() + 1);
  const endDateString = endPlus1.toISOString().slice(0, 10);

  const dates = new Set<string>();
  let cursor: number | string | null = null;
  for (let page = 0; page < 20; page++) {
    type SoloMiningListResponse = {
      data: {
        items?: Array<{ incomeStatistic?: { calculatedAt?: string }; createdAt?: string }>;
        nextCursor?: number | string | null;
      };
    };
    const response: SoloMiningListResponse = await postJson<SoloMiningListResponse>(
      `${API}/api/nft-income/list`,
      headers,
      {
        dateFrom: `${cycleStartDate}T00:00:00.000Z`,
        dateTo: `${endDateString}T23:59:59.999Z`,
        limit: 50,
        ...(cursor != null ? { cursor } : {}),
      },
    );

    const items = response.data?.items ?? [];
    for (const row of items) {
      const date = (row.incomeStatistic?.calculatedAt ?? row.createdAt ?? "").slice(0, 10);
      if (date) dates.add(date);
    }

    const next = response.data?.nextCursor ?? null;
    if (next == null || items.length < 50) break;
    cursor = next;
  }
  return dates;
}
