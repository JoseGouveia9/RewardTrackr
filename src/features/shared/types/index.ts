import type { CacheState } from "@/features/export/types";

export interface OwnedProfile {
  id: string;
  alias?: string;
  updatedAt?: string | null;
  communityVisible?: boolean;
}

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
