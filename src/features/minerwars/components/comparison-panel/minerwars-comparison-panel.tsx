import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMinerWarsComparison } from "../../hooks/use-minerwars-comparison";
import { useClanPerformance } from "../../hooks/use-clan-performance";
import type { Currency } from "@/types/currency";
import { RefreshIcon } from "@/components/icons";
import { useExtraFiatRate } from "../../hooks/use-extra-fiat-rate";
import { useMinerWarsSimulation } from "../simulate-modal/hooks/use-minerwars-simulation";
import { MinerWarsIndividualView } from "../individual-view/minerwars-individual-view";
import { MinerWarsClanView } from "../clan-view/minerwars-clan-view";
import {
  CycleDropdown,
  IndividualSkeletonBody,
} from "./components/minerwars-panel-parts/minerwars-panel-parts";
import { getMinerWarsPanelViewModel } from "../../utils/minerwars-panel-view-model";
import type { MinerWarsShareSnapshot } from "../../types/share-types";
import { MinerWarsSimulateModal } from "../simulate-modal/minerwars-simulate-modal";
import "./minerwars-comparison-panel-selector.css";
import "./minerwars-comparison-panel-hero-rows.css";
import "./minerwars-comparison-panel-status-simulate.css";
import "./minerwars-comparison-panel-light.css";

interface MinerWarsComparisonPanelProps {
  cacheVersion?: number;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  extraFiatCode?: string | null;
  isPrefetching?: boolean;
  onShareSnapshotChange?: (snapshot: MinerWarsShareSnapshot | null) => void;
  onBusyChange?: (busy: boolean) => void;
}

export function MinerWarsComparisonPanel({
  cacheVersion = 0,
  currency = "BTC",
  onCurrencyChange,
  extraFiatCode = null,
  isPrefetching = false,
  onShareSnapshotChange,
  onBusyChange,
}: MinerWarsComparisonPanelProps) {
  const { t } = useTranslation();
  const {
    cycles,
    loadingCycles,
    selectedCycleId,
    setSelectedCycleId,
    data,
    loading,
    error,
    refresh,
    isLoggedIn,
  } = useMinerWarsComparison({ cacheVersion });

  const isCycleLive = data != null && data.actualMinerWarsBtc == null;
  const extraFiatRate = useExtraFiatRate(extraFiatCode);
  const simulation = useMinerWarsSimulation({
    data,
    selectedCycleId,
    isCycleLive,
    currency,
    extraFiatCode,
    extraFiatRate,
  });

  const showSkeleton = loadingCycles || loading || isPrefetching;

  const selectedCycle = cycles.find((cycle) => cycle.cycleId === selectedCycleId);

  const [tab, setTab] = useState<"individual" | "clan">("individual");
  const clanNotAvailable = selectedCycle?.status === "completed";
  useEffect(() => {
    if (clanNotAvailable && tab === "clan") setTab("individual");
  }, [clanNotAvailable, tab]);
  const clanPerformance = useClanPerformance({
    cycleId: selectedCycleId,
    cycleStatus: selectedCycle?.status,
    cycleStart: data?.cycleStart,
    cycleEnd: data?.cycleEnd,
    clanMinerWarsSats: data?.clanMinerWarsSats,
    enabled: tab === "clan",
  });

  const canRefreshSelectedCycle =
    isLoggedIn && (selectedCycle?.status === "in-progress" || selectedCycle?.status === "pending");
  const [manualClanRefreshing, setManualClanRefreshing] = useState(false);
  const refreshingSelectedView =
    loading || manualClanRefreshing || (tab === "clan" && clanPerformance.loading);
  const handleSelectedViewRefresh = useCallback(async () => {
    if (tab === "clan" || clanPerformance.data != null) {
      setManualClanRefreshing(true);
      try {
        await Promise.all([refresh(), clanPerformance.refresh()]);
      } finally {
        setManualClanRefreshing(false);
      }
      return;
    }
    return refresh();
  }, [clanPerformance, refresh, tab]);

  const isBusy = showSkeleton || refreshingSelectedView;
  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (!onShareSnapshotChange) return;
    if (!data) {
      onShareSnapshotChange(null);
      return;
    }

    onShareSnapshotChange({
      currentViewMode: tab,
      selectedCycleId,
      cycles,
      comparison: data,
      clanPerformance: clanPerformance.data ?? null,
      currency,
      extraFiatCode,
      extraFiatRate,
    });
  }, [
    onShareSnapshotChange,
    data,
    clanPerformance.data,
    tab,
    selectedCycleId,
    cycles,
    currency,
    extraFiatCode,
    extraFiatRate,
  ]);

  const viewModel = getMinerWarsPanelViewModel({
    data,
    currency,
    activeTab: tab,
    extraFiatCode,
    extraFiatRate,
  });
  const {
    clanMinerWarsBtc,
    clanTargetBtc,
    btcPerBlockSats,
    canShowGmt,
    canShowUsd,
    canShowFiat,
    activeCurrencyOptions,
    activeCurrencyOption,
  } = viewModel;

  useEffect(() => {
    if (currency === "GMT" && !canShowGmt) onCurrencyChange?.("BTC");
    if (currency === "USD" && !canShowUsd) onCurrencyChange?.(canShowGmt ? "GMT" : "BTC");
    if (currency === "FIAT" && !canShowFiat) {
      onCurrencyChange?.(canShowUsd ? "USD" : canShowGmt ? "GMT" : "BTC");
    }
  }, [canShowFiat, canShowGmt, canShowUsd, currency, onCurrencyChange]);

  function handleCycleCurrency() {
    if (!onCurrencyChange || activeCurrencyOptions.length === 0) return;
    const index = activeCurrencyOptions.findIndex((option) => option.key === currency);
    const nextIndex = index >= 0 ? (index + 1) % activeCurrencyOptions.length : 0;
    onCurrencyChange(activeCurrencyOptions[nextIndex]!.key);
  }

  if (error && !data && !showSkeleton) return null;

  return (
    <div className="minerwars-panel">
      {cycles.length > 0 && (
        <div className="minerwars-panel-cycle-selector-row">
          <div className="minerwars-panel-cycle-meta">
            <CycleDropdown
              cycles={cycles}
              selectedCycleId={selectedCycleId}
              dateRange={data ? `${data.cycleStart} → ${data.cycleEnd} UTC` : undefined}
              onSelect={setSelectedCycleId}
            />
            {activeCurrencyOptions.length > 1 && activeCurrencyOption && (
              <button
                type="button"
                className="minerwars-panel-mode-btn"
                onClick={handleCycleCurrency}
                title={activeCurrencyOption.title}
                aria-label={activeCurrencyOption.title}
              >
                {activeCurrencyOption.icon}
              </button>
            )}
            {canRefreshSelectedCycle && (
              <button
                type="button"
                className="minerwars-panel-refresh-btn"
                onClick={() => void handleSelectedViewRefresh()}
                disabled={refreshingSelectedView}
                title={
                  selectedCycle?.status === "pending"
                    ? t("cycleTracker.refreshPending")
                    : t("cycleTracker.refreshLive")
                }
              >
                <RefreshIcon
                  width={13}
                  height={13}
                  className={refreshingSelectedView ? "minerwars-panel-spin" : undefined}
                />
              </button>
            )}
          </div>
        </div>
      )}

      {cycles.length > 0 && selectedCycle?.status !== "completed" && (
        <div className="minerwars-panel-tab-bar">
          <div
            aria-hidden="true"
            className={`minerwars-panel-tab-slider minerwars-panel-tab-slider--${tab}`}
          />
          <button
            type="button"
            className={`minerwars-panel-tab-btn${tab === "individual" ? " minerwars-panel-tab-btn--active" : ""}`}
            onClick={() => setTab("individual")}
          >
            {t("cycleTracker.tabIndividual")}
          </button>
          <button
            type="button"
            className={`minerwars-panel-tab-btn${tab === "clan" ? " minerwars-panel-tab-btn--active" : ""}`}
            onClick={() => setTab("clan")}
            disabled={clanNotAvailable}
            title={clanNotAvailable ? t("cycleTracker.clanNotAvailableCompleted") : undefined}
          >
            {t("cycleTracker.tabClan")}
          </button>
        </div>
      )}

      {tab === "clan" ? (
        <MinerWarsClanView
          data={clanPerformance.data}
          loading={showSkeleton || clanPerformance.loading || manualClanRefreshing}
          error={clanPerformance.error}
          figures={{
            targetBtc: clanTargetBtc,
            minerWarsBtc: clanMinerWarsBtc,
            btcPerBlockSats,
            actualDays: data?.clanTargetActualDays ?? 0,
            projectedDays: data?.clanTargetProjectedDays ?? 0,
          }}
          display={{
            currency,
            fiatCode: extraFiatCode,
            extraFiatRate,
            btcPrice: data?.btcPrice ?? null,
            gmtPrice: data?.gmtPrice ?? null,
          }}
          isLiveCycle={selectedCycle?.status === "in-progress"}
        />
      ) : showSkeleton || !data ? (
        <IndividualSkeletonBody />
      ) : (
        <>
          {simulation.modalProps && <MinerWarsSimulateModal {...simulation.modalProps} />}
          <MinerWarsIndividualView
            data={data}
            viewModel={viewModel}
            simulation={simulation}
            isCycleLive={isCycleLive}
          />
        </>
      )}
    </div>
  );
}
