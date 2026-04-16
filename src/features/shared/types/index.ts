import type { CacheState } from "@/features/export/types";

export interface OwnedProfile {
  id: string;
  alias?: string;
  updatedAt?: string | null;
}

export interface DirectoryEntry {
  alias: string;
  id: string;
  ownerId?: string;
  updatedAt: string;
}

export interface SharedProfile {
  alias: string;
  id: string;
  ownerId?: string;
  updatedAt: string;
  sheets: Partial<CacheState>;
}
