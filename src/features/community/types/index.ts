import type { CacheState } from "@/types/rewards";

export interface DirectoryEntry {
  alias: string;
  id: string;
  ownerId?: string;
  updatedAt: string;
  communityVisible?: boolean;
}

export interface SharedProfile {
  alias: string;
  id: string;
  ownerId?: string;
  updatedAt: string;
  communityVisible?: boolean;
  sheets: Partial<CacheState>;
}
