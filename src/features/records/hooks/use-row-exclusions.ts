import { useMemo } from "react";
import type { RewardKey } from "@/types/rewards";
import { useRowSelection } from "../stores/row-selection-context";

/**
 * Splits rows into excluded and selected based on the share selection context; without one, all
 * rows count as selected.
 */
export function useRowExclusions<T extends { rowId: string }>(
  rewardKey: RewardKey,
  filteredRows: T[],
) {
  const rowSelection = useRowSelection();
  const excluded = useMemo(
    () => new Set(rowSelection?.exclusions[rewardKey] ?? []),
    [rowSelection, rewardKey],
  );
  const selectedRows = useMemo(
    () => (rowSelection ? filteredRows.filter((row) => !excluded.has(row.rowId)) : filteredRows),
    [filteredRows, rowSelection, excluded],
  );
  return { rowSelection, excluded, selectedRows };
}
