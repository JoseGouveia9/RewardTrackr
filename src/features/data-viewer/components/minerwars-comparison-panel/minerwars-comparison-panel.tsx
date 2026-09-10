import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ClanPerformance } from "@/lib/minerwars/clan-performance";
import {
  getSimulationDefaults,
  simulateMaintenanceAndNet,
  type SimulationInputs,
} from "@/lib/minerwars/comparison";
import { fetchLatestRate } from "@/features/export/api/fx-rates";
import { useMinerWarsComparison } from "../../hooks/use-minerwars-comparison";
import { useClanPerformance } from "../../hooks/use-clan-performance";
import { useOutsideClick } from "../../hooks/use-outside-click";
import type { Currency } from "../../types";
import { MinerWarsClanView } from "./minerwars-clan-view";
import { CycleDropdown, MinerWarsSkeleton } from "./minerwars-panel-parts";
import { MinerWarsSimulateModal } from "./minerwars-simulate-modal";
import { getMinerWarsPanelViewModel } from "./minerwars-panel-view-model";
import { MinerWarsIndividualView } from "./minerwars-individual-view";
import type { MinerWarsShareSnapshot } from "./minerwars-share-types";
import { RefreshIcon } from "../icons";
import "./minerwars-comparison-panel.css";

interface MinerWarsComparisonPanelProps {
  cacheVersion?: number;
  currency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
  extraFiatCode?: string | null;
  isPrefetching?: boolean;
  onShareSnapshotChange?: (snapshot: MinerWarsShareSnapshot | null) => void;
}

export function MinerWarsComparisonPanel({
  cacheVersion = 0,
  currency = "BTC",
  onCurrencyChange,
  extraFiatCode = null,
  isPrefetching = false,
  onShareSnapshotChange,
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
  const simulationDefaults =
    selectedCycleId != null ? getSimulationDefaults(selectedCycleId) : null;
  const canSimulate = isCycleLive && simulationDefaults != null;
  const [simulateOpen, setSimulateOpen] = useState(false);
  const simulateRef = useRef<HTMLDivElement>(null);
  useOutsideClick(simulateRef, () => setSimulateOpen(false), simulateOpen);

  const [simTh, setSimTh] = useState("");
  const [simUserEE, setSimUserEE] = useState("");
  const [simLeagueEE, setSimLeagueEE] = useState("");
  const [simPersonalDiscountPct, setSimPersonalDiscountPct] = useState("");
  const [simLeagueDiscountPct, setSimLeagueDiscountPct] = useState("");
  const [simulateCurrency, setSimulateCurrency] = useState<Currency>("BTC");
  const [extraFiatRate, setExtraFiatRate] = useState<number | null>(null);
  const [lastSimulatedResult, setLastSimulatedResult] = useState<ReturnType<
    typeof simulateMaintenanceAndNet
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!extraFiatCode) {
      setExtraFiatRate(null);
      return () => {
        cancelled = true;
      };
    }

    void fetchLatestRate(extraFiatCode)
      .then((rate) => {
        if (!cancelled) setExtraFiatRate(rate);
      })
      .catch(() => {
        if (!cancelled) setExtraFiatRate(null);
      });

    return () => {
      cancelled = true;
    };
  }, [extraFiatCode]);

  function resetSimulateInputs() {
    setSimTh(simulationDefaults?.th != null ? simulationDefaults.th.toFixed(2) : "");
    setSimUserEE(simulationDefaults?.userEE != null ? simulationDefaults.userEE.toFixed(2) : "");
    setSimLeagueEE(
      simulationDefaults?.leagueEE != null ? simulationDefaults.leagueEE.toFixed(2) : "",
    );
    setSimPersonalDiscountPct(
      simulationDefaults?.personalDiscountPct != null
        ? (simulationDefaults.personalDiscountPct * 100).toFixed(2)
        : "",
    );
    setSimLeagueDiscountPct(
      data?.leagueDiscountPct != null ? (data.leagueDiscountPct * 100).toFixed(2) : "",
    );
  }

  function toggleSimulate() {
    if (!simulateOpen) {
      resetSimulateInputs();
      setSimulateCurrency(currency);
    }
    setSimulateOpen((o) => !o);
  }

  const computedSimulated = useMemo(() => {
    if (!simulateOpen || !canSimulate || selectedCycleId == null) return null;
    const overrides: SimulationInputs = {};
    const thNum = parseFloat(simTh);
    if (simTh !== "" && !Number.isNaN(thNum)) overrides.th = thNum;
    const userEENum = parseFloat(simUserEE);
    if (simUserEE !== "" && !Number.isNaN(userEENum)) overrides.userEE = userEENum;
    const leagueEENum = parseFloat(simLeagueEE);
    if (simLeagueEE !== "" && !Number.isNaN(leagueEENum)) overrides.leagueEE = leagueEENum;
    const personalDiscNum = parseFloat(simPersonalDiscountPct);
    if (simPersonalDiscountPct !== "" && !Number.isNaN(personalDiscNum))
      overrides.personalDiscountPct = personalDiscNum / 100;
    const leagueDiscNum = parseFloat(simLeagueDiscountPct);
    if (simLeagueDiscountPct !== "" && !Number.isNaN(leagueDiscNum))
      overrides.leagueDiscountPct = leagueDiscNum / 100;
    return simulateMaintenanceAndNet(selectedCycleId, overrides);
  }, [
    simulateOpen,
    canSimulate,
    selectedCycleId,
    simTh,
    simUserEE,
    simLeagueEE,
    simPersonalDiscountPct,
    simLeagueDiscountPct,
  ]);
  useEffect(() => {
    if (computedSimulated) setLastSimulatedResult(computedSimulated);
  }, [computedSimulated]);
  const simulated = computedSimulated ?? lastSimulatedResult;

  const showSkeleton = loadingCycles || loading || isPrefetching;

  const selectedCycle = cycles.find((c) => c.cycleId === selectedCycleId);

  const [tab, setTab] = useState<"individual" | "clan">("individual");
  const clanNotAvailable = selectedCycle?.status === "completed";
  useEffect(() => {
    if (clanNotAvailable && tab === "clan") setTab("individual");
  }, [clanNotAvailable, tab]);
  const clanPerf = useClanPerformance({
    cycleId: selectedCycleId,
    cycleStatus: selectedCycle?.status,
    cycleStart: data?.cycleStart,
    cycleEnd: data?.cycleEnd,
    clanMinerWarsSats: data?.clanMinerWarsSats,
    enabled: tab === "clan",
  });

  const canRefreshSelectedCycle =
    isLoggedIn && (selectedCycle?.status === "in-progress" || selectedCycle?.status === "pending");
  const refreshingSelectedView = loading || (tab === "clan" && clanPerf.loading);
  const handleSelectedViewRefresh = useCallback(() => {
    if (tab === "clan") return clanPerf.refresh();
    return refresh();
  }, [clanPerf, refresh, tab]);

  useEffect(() => {
    if (!onShareSnapshotChange) return;
    if (!data) {
      onShareSnapshotChange(null);
      return;
    }

    const clanData: ClanPerformance | null = clanPerf.data ?? null;
    onShareSnapshotChange({
      currentViewMode: tab,
      selectedCycleId,
      selectedCycleStatus: selectedCycle?.status,
      cycles,
      comparison: data,
      clanPerformance: clanData,
      currency,
      extraFiatCode,
      extraFiatRate,
    });
  }, [
    onShareSnapshotChange,
    data,
    clanPerf.data,
    tab,
    selectedCycleId,
    selectedCycle?.status,
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

  const simulateViewModel = getMinerWarsPanelViewModel({
    data,
    currency: simulateCurrency,
    activeTab: "individual",
    extraFiatCode,
    extraFiatRate,
  });
  const {
    isActual,
    soloEquivBtc,
    effectiveMw,
    effectiveDiff,
    effectiveDiffPct,
    effectiveProgress,
    isPositive,
    projecting,
    maintenancePct,
    clanMinerWarsBtc,
    clanTargetBtc,
    btcPerBlockSats,
    showNoClanAnalyticsWarning,
    showBtcFundZeroWarning,
    zeroedRounds,
    showZeroedRoundsWarning,
    hintUserEE,
    hintLeagueEE,
    hintBtcPrice,
    canShowGmt,
    canShowUsd,
    canShowFiat,
    showGmt,
    showUsd,
    showFiat,
    heroGmt,
    soloGmt,
    targetGmt,
    diffGmt,
    heroUsd,
    soloUsd,
    targetUsd,
    diffUsd,
    activeCurrencyOptions,
    activeCurrencyOption,
    renderValueIcon,
    formatBtcValue,
  } = viewModel;

  const {
    individualCurrencyOptions: simulateCurrencyOptions,
    activeCurrencyOption: simulateCurrencyOption,
    renderValueIcon: renderSimulateValueIcon,
    formatBtcValue: formatSimulateBtcValue,
    showGmt: showSimulateGmt,
    showUsd: showSimulateUsd,
    showFiat: showSimulateFiat,
  } = simulateViewModel;

  useEffect(() => {
    if (!simulateOpen || simulateCurrencyOptions.length === 0) return;
    const isValid = simulateCurrencyOptions.some((option) => option.key === simulateCurrency);
    if (!isValid) setSimulateCurrency(simulateCurrencyOptions[0]!.key);
  }, [simulateCurrency, simulateCurrencyOptions, simulateOpen]);

  useEffect(() => {
    if (currency === "GMT" && !canShowGmt) onCurrencyChange?.("BTC");
    if (currency === "USD" && !canShowUsd) onCurrencyChange?.(canShowGmt ? "GMT" : "BTC");
    if (currency === "FIAT" && !canShowFiat) {
      onCurrencyChange?.(canShowUsd ? "USD" : canShowGmt ? "GMT" : "BTC");
    }
  }, [canShowFiat, canShowGmt, canShowUsd, currency, onCurrencyChange]);

  useEffect(() => {
    if (tab === "clan" && currency === "GMT") {
      onCurrencyChange?.("BTC");
    }
  }, [currency, onCurrencyChange, tab]);

  function handleCycleCurrency() {
    if (!onCurrencyChange || activeCurrencyOptions.length === 0) return;
    const index = activeCurrencyOptions.findIndex((option) => option.key === currency);
    const nextIndex = index >= 0 ? (index + 1) % activeCurrencyOptions.length : 0;
    onCurrencyChange(activeCurrencyOptions[nextIndex]!.key);
  }

  function handleSimulateCurrency() {
    if (simulateCurrencyOptions.length === 0) return;
    const index = simulateCurrencyOptions.findIndex((option) => option.key === simulateCurrency);
    const nextIndex = index >= 0 ? (index + 1) % simulateCurrencyOptions.length : 0;
    setSimulateCurrency(simulateCurrencyOptions[nextIndex]!.key);
  }

  if (showSkeleton) return <MinerWarsSkeleton />;

  if (error && !data) return null;

  const simulateModal = canSimulate ? (
    <MinerWarsSimulateModal
      open={simulateOpen}
      simulated={simulated}
      activeCurrencyOptions={simulateCurrencyOptions}
      activeCurrencyOption={simulateCurrencyOption}
      handleCycleCurrency={handleSimulateCurrency}
      renderValueIcon={renderSimulateValueIcon}
      formatBtcValue={formatSimulateBtcValue}
      showGmt={showSimulateGmt}
      showUsd={showSimulateUsd}
      showFiat={showSimulateFiat}
      extraFiatRate={extraFiatRate}
      extraFiatCode={extraFiatCode}
      simTh={simTh}
      setSimTh={setSimTh}
      simUserEE={simUserEE}
      setSimUserEE={setSimUserEE}
      simLeagueEE={simLeagueEE}
      setSimLeagueEE={setSimLeagueEE}
      simPersonalDiscountPct={simPersonalDiscountPct}
      setSimPersonalDiscountPct={setSimPersonalDiscountPct}
      simLeagueDiscountPct={simLeagueDiscountPct}
      setSimLeagueDiscountPct={setSimLeagueDiscountPct}
      onClose={() => setSimulateOpen(false)}
      containerRef={simulateRef}
    />
  ) : null;

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
          data={clanPerf.data}
          loading={clanPerf.loading}
          error={clanPerf.error}
          clanTargetBtc={clanTargetBtc}
          clanMinerWarsBtc={clanMinerWarsBtc}
          btcPerBlockSats={btcPerBlockSats}
          targetActualDays={data?.targetActualDays ?? 0}
          targetProjectedDays={data?.targetProjectedDays ?? 0}
          currency={currency}
          fiatCode={extraFiatCode}
          extraFiatRate={extraFiatRate}
          btcPrice={data?.btcPrice ?? null}
          gmtPrice={data?.gmtPrice ?? null}
          isLiveCycle={selectedCycle?.status === "in-progress"}
        />
      ) : (
        <>
          {simulateModal}
          {data && (
            <MinerWarsIndividualView
              data={data}
              canSimulate={canSimulate}
              simulateOpen={simulateOpen}
              onToggleSimulate={toggleSimulate}
              effectiveProgress={effectiveProgress}
              renderValueIcon={renderValueIcon}
              formatBtcValue={formatBtcValue}
              effectiveMw={effectiveMw}
              heroGmt={heroGmt}
              heroUsd={heroUsd}
              isActual={isActual}
              projecting={projecting}
              targetGmt={targetGmt}
              targetUsd={targetUsd}
              soloEquivBtc={soloEquivBtc}
              soloGmt={soloGmt}
              soloUsd={soloUsd}
              isPositive={isPositive}
              effectiveDiff={effectiveDiff}
              diffGmt={diffGmt}
              diffUsd={diffUsd}
              effectiveDiffPct={effectiveDiffPct}
              showGmt={showGmt}
              showUsd={showUsd}
              showFiat={showFiat}
              extraFiatRate={extraFiatRate}
              extraFiatCode={extraFiatCode}
              maintenancePct={maintenancePct}
              showBtcFundZeroWarning={showBtcFundZeroWarning}
              showZeroedRoundsWarning={showZeroedRoundsWarning}
              zeroedRounds={zeroedRounds}
              hintUserEE={hintUserEE}
              hintLeagueEE={hintLeagueEE}
              hintBtcPrice={hintBtcPrice}
              isCycleLive={isCycleLive}
              showNoClanAnalyticsWarning={showNoClanAnalyticsWarning}
            />
          )}
        </>
      )}
    </div>
  );
}
