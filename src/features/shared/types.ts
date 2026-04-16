import type { CacheState } from "@/features/export/types";

export interface DirectoryEntry {
  alias: string;
  id: string;
  updatedAt: string;
}

export interface SharedProfile {
  alias: string;
  id: string;
  updatedAt: string;
  sheets: Partial<CacheState>;
}
