import type { DifficultyEntry } from "@/features/minerwars/api/difficulty-adjustments";
import type { CacheState } from "@/types/rewards";
import type { DateRange, TabDef } from "@/features/records/types";

export interface ViewSelectorConfig {
  views: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}

export interface RecordsActions {
  onShare?: () => void;
  onRefresh?: () => void | Promise<void>;
  onDownload?: () => void | Promise<void>;
  onOpenSettings?: () => void;
  disabled?: boolean;
}

export interface HeaderOptions {
  title?: string | null;
  hidden?: boolean;
  showBackButton?: boolean;
}

export interface TableCommonProps {
  fiatCode: string;
  isFetching: boolean;
  cacheVersion: number;
  groupByDay: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  pageSize?: number;
}

export interface MiningTableState {
  minerWarsPrefetching: boolean;
  page: number;
  setPage: (page: number) => void;
  trends: { show: boolean; animating: boolean; exiting: boolean };
  difficultyMap: Map<string, DifficultyEntry>;
  isShared: boolean;
  onCycleTrackerOpenChange: (open: boolean) => void;
  shareDisabled: boolean;
}

export type TabKind = TabDef["kind"];
export type SharedData = Partial<CacheState> | null | undefined;
