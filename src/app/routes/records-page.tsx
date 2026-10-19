import { useCallback } from "react";
import { useNavigate } from "react-router";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import { DataViewer } from "@/features/records";
import type { CacheState, RewardKey } from "@/types/rewards";
import { StatusMessage } from "../../components/status-message/status-message";

interface RecordsPageProps {
  cache: CacheState;
  cacheVersion: number;
  onTabSeen: (key: RewardKey) => void;
  status: { message: string; onClose: () => void };
  fetchState: {
    loading: boolean;
    fetchingKeys: Set<RewardKey>;
    minerWarsPrefetching: boolean;
  };
  actions: {
    onRefreshKeys: (keys: RewardKey[]) => Promise<void>;
    onDownloadRecords: () => Promise<void>;
    onShare?: () => void;
  };
}

export function RecordsPage({
  cache,
  cacheVersion,
  onTabSeen,
  status,
  fetchState,
  actions,
}: RecordsPageProps) {
  const { loading, fetchingKeys, minerWarsPrefetching } = fetchState;
  const { onRefreshKeys, onDownloadRecords, onShare } = actions;
  const navigate = useNavigate();

  const handleRefreshRecords = useCallback(async (): Promise<void> => {
    const keys = ALL_REWARD_KEYS.filter((key) => cache[key] !== null);
    if (keys.length === 0) return;
    await onRefreshKeys(keys);
  }, [cache, onRefreshKeys]);

  return (
    <>
      <StatusMessage message={status.message} onClose={status.onClose} />
      <DataViewer
        onClose={() => void navigate("/")}
        isFetching={loading}
        fetchingKeys={fetchingKeys}
        cacheVersion={cacheVersion}
        minerWarsPrefetching={minerWarsPrefetching}
        onTabSeen={onTabSeen}
        sharedData={null}
        header={{ title: null, showBackButton: false }}
        actions={{
          onRefresh: handleRefreshRecords,
          onDownload: onDownloadRecords,
          onOpenSettings: () => void navigate("/build"),
          onShare,
          disabled: loading,
        }}
      />
    </>
  );
}
