import { createContext, useContext } from "react";
import type { RewardKey } from "@/types/rewards";

export interface RowSelectionContextValue {
  exclusions: Partial<Record<RewardKey, string[]>>;
  onToggle: (key: RewardKey, ids: string[]) => void;
}

const RowSelectionContext = createContext<RowSelectionContextValue | null>(null);

export const RowSelectionProvider = RowSelectionContext.Provider;

export function useRowSelection(): RowSelectionContextValue | null {
  return useContext(RowSelectionContext);
}

/**
 * Row class and click handler for selectable rows; a group counts as excluded only if all its ids
 * are.
 */
export function getSelectableRowProps(
  rowSelection: RowSelectionContextValue | null,
  excluded: Set<string>,
  key: RewardKey,
  ids: string[],
) {
  if (!rowSelection) return { className: "", onClick: undefined };
  return {
    className: ids.every((id) => excluded.has(id)) ? "dv-row--excluded" : "dv-row--selected",
    onClick: () => rowSelection.onToggle(key, ids),
  };
}
