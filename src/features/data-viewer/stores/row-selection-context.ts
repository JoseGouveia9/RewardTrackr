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
