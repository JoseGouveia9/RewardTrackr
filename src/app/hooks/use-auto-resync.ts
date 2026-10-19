import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { RewardKey } from "@/types/rewards";

interface AutoResyncOptions {
  dataVersionWiped: boolean;
  storedToken: string;
  selectedKeys: RewardKey[];
  handleExport: () => Promise<void>;
  onMessage: (message: string) => void;
}

/**
 * Triggers one automatic export when a cache version bump wiped data and a token and selection
 * exist.
 */
export function useAutoResync({
  dataVersionWiped,
  storedToken,
  selectedKeys,
  handleExport,
  onMessage,
}: AutoResyncOptions): void {
  const { t } = useTranslation();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!dataVersionWiped || startedRef.current) return;
    if (!storedToken || selectedKeys.length === 0) return;
    startedRef.current = true;
    onMessage(
      t("app.dataUpdatedResync", {
        defaultValue: "We updated how records/MinerWars are calculated — resyncing your data…",
      }),
    );
    void handleExport();
  }, [dataVersionWiped, storedToken, selectedKeys, handleExport, onMessage, t]);
}
