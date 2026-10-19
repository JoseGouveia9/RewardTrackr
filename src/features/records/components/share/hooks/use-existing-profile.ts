import { useEffect, useState } from "react";
import { fetchMySharedProfile } from "../api";
import { fetchSharedProfile } from "@/features/community/api";
import type { RewardKey } from "@/types/rewards";
import type { OwnedProfile } from "../types";

/**
 * Loads the user's published profile and reports which sheets it previously included.
 * Community visibility defaults to on unless the worker says otherwise; sheet lookup failures are ignored.
 */
export function useExistingProfile({
  authToken,
  workerReady,
  availableSheets,
  onPreviousSheets,
}: {
  authToken: string;
  workerReady: boolean;
  availableSheets: RewardKey[];
  onPreviousSheets: (keys: RewardKey[]) => void;
}) {
  const [existingLoading, setExistingLoading] = useState(false);
  const [existingProfile, setExistingProfile] = useState<OwnedProfile | null>(null);
  const [shareInCommunity, setShareInCommunity] = useState(true);

  useEffect(() => {
    if (!workerReady || !authToken) return;
    let alive = true;
    setExistingLoading(true);
    fetchMySharedProfile(authToken)
      .then(async (data) => {
        if (!alive) return;
        if (data.exists && data.id) {
          const isVisible = data.communityVisible !== false;
          setExistingProfile({
            id: data.id,
            alias: data.alias,
            updatedAt: data.updatedAt,
            communityVisible: isVisible,
          });
          setShareInCommunity(isVisible);
          try {
            const full = await fetchSharedProfile(data.id);
            if (!alive) return;
            const previousSheetKeys = availableSheets.filter(
              (rewardKey) => rewardKey in full.sheets,
            );
            if (previousSheetKeys.length > 0) onPreviousSheets(previousSheetKeys);
            // eslint-disable-next-line no-empty
          } catch {}
        } else {
          setExistingProfile(null);
          setShareInCommunity(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        setExistingProfile(null);
      })
      .finally(() => {
        if (!alive) return;
        setExistingLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [authToken, workerReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    existingLoading,
    existingProfile,
    setExistingProfile,
    shareInCommunity,
    setShareInCommunity,
  };
}
