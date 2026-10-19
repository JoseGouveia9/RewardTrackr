import { useEffect, useMemo, useRef, useState } from "react";
import type { MinerWarsComparison } from "@/features/minerwars/utils/comparison";
import {
  getSimulationDefaults,
  simulateMaintenanceAndNet,
  type LeagueGroupOverride,
  type SimulationInputs,
} from "@/features/minerwars/utils/comparison-simulation";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { Currency } from "@/types/currency";
import { getMinerWarsPanelViewModel } from "@/features/minerwars/utils/minerwars-panel-view-model";
import type { MinerWarsSimulateModalProps } from "../minerwars-simulate-modal";

type LeagueGroupInput = { leagueEnergyEfficiency: string; leagueDiscountPercent: string };

interface UseMinerWarsSimulationArguments {
  data: MinerWarsComparison | null;
  selectedCycleId: number | null;
  isCycleLive: boolean;
  currency: Currency;
  extraFiatCode: string | null;
  extraFiatRate: number | null;
}

/**
 * Holds the what-if inputs (TH, EE, discounts per league group) for a live cycle and runs the
 * simulated maintenance/net calculation.
 */
export function useMinerWarsSimulation({
  data,
  selectedCycleId,
  isCycleLive,
  currency,
  extraFiatCode,
  extraFiatRate,
}: UseMinerWarsSimulationArguments) {
  const simulationDefaults =
    selectedCycleId != null ? getSimulationDefaults(selectedCycleId) : null;
  const canSimulate = isCycleLive && simulationDefaults != null;
  const [simulateOpen, setSimulateOpen] = useState(false);
  const simulateRef = useRef<HTMLDivElement>(null);
  useOutsideClick(simulateRef, () => setSimulateOpen(false), simulateOpen);

  const [simulatedTerahash, setSimulatedTerahash] = useState("");
  const [simulatedUserEnergyEfficiency, setSimulatedUserEnergyEfficiency] = useState("");
  const [simulatedPersonalDiscountPercent, setSimulatedPersonalDiscountPercent] = useState("");
  const [simulationLeagueGroupValues, setSimulationLeagueGroupValues] = useState<
    Record<string, LeagueGroupInput>
  >({});
  const [simulateCurrency, setSimulateCurrency] = useState<Currency>("BTC");
  const [lastSimulatedResult, setLastSimulatedResult] = useState<ReturnType<
    typeof simulateMaintenanceAndNet
  > | null>(null);

  function resetSimulateInputs() {
    setSimulatedTerahash(
      simulationDefaults?.terahash != null ? simulationDefaults.terahash.toFixed(2) : "",
    );
    setSimulatedUserEnergyEfficiency(
      simulationDefaults?.userEnergyEfficiency != null
        ? simulationDefaults.userEnergyEfficiency.toFixed(2)
        : "",
    );
    setSimulatedPersonalDiscountPercent(
      simulationDefaults?.personalDiscountPercent != null
        ? (simulationDefaults.personalDiscountPercent * 100).toFixed(2)
        : "",
    );
    const groupValues: Record<string, LeagueGroupInput> = {};
    for (const group of simulationDefaults?.leagueGroups ?? []) {
      groupValues[`${group.leagueId}:${group.clanId}`] = {
        leagueEnergyEfficiency: group.leagueEnergyEfficiency.toFixed(2),
        leagueDiscountPercent: (group.leagueDiscountPercent * 100).toFixed(2),
      };
    }
    setSimulationLeagueGroupValues(groupValues);
  }

  function setSimulationLeagueGroupValue(
    key: string,
    field: "leagueEE" | "leagueDiscountPct",
    value: string,
  ) {
    setSimulationLeagueGroupValues((previousValues) => ({
      ...previousValues,
      [key]: { ...previousValues[key], [field]: value } as LeagueGroupInput,
    }));
  }

  function toggleSimulate() {
    if (!simulateOpen) {
      resetSimulateInputs();
      setSimulateCurrency(currency);
    }
    setSimulateOpen((wasOpen) => !wasOpen);
  }

  const computedSimulated = useMemo(() => {
    if (!simulateOpen || !canSimulate || selectedCycleId == null) return null;
    const overrides: SimulationInputs = {};
    const terahashNumber = parseFloat(simulatedTerahash);
    if (simulatedTerahash !== "" && !Number.isNaN(terahashNumber))
      overrides.terahash = terahashNumber;
    const userEnergyEfficiencyNumber = parseFloat(simulatedUserEnergyEfficiency);
    if (simulatedUserEnergyEfficiency !== "" && !Number.isNaN(userEnergyEfficiencyNumber))
      overrides.userEnergyEfficiency = userEnergyEfficiencyNumber;
    const personalDiscountNumber = parseFloat(simulatedPersonalDiscountPercent);
    if (simulatedPersonalDiscountPercent !== "" && !Number.isNaN(personalDiscountNumber))
      overrides.personalDiscountPercent = personalDiscountNumber / 100;
    const leagueGroupOverrides: LeagueGroupOverride[] = [];
    for (const group of simulationDefaults?.leagueGroups ?? []) {
      const key = `${group.leagueId}:${group.clanId}`;
      const values = simulationLeagueGroupValues[key];
      if (!values) continue;
      const groupOverride: LeagueGroupOverride = { leagueId: group.leagueId, clanId: group.clanId };
      const leagueEnergyEfficiencyNumber = parseFloat(values.leagueEnergyEfficiency);
      if (values.leagueEnergyEfficiency !== "" && !Number.isNaN(leagueEnergyEfficiencyNumber))
        groupOverride.leagueEnergyEfficiency = leagueEnergyEfficiencyNumber;
      const leagueDiscountNumber = parseFloat(values.leagueDiscountPercent);
      if (values.leagueDiscountPercent !== "" && !Number.isNaN(leagueDiscountNumber))
        groupOverride.leagueDiscountPercent = leagueDiscountNumber / 100;
      if (
        groupOverride.leagueEnergyEfficiency != null ||
        groupOverride.leagueDiscountPercent != null
      )
        leagueGroupOverrides.push(groupOverride);
    }
    if (leagueGroupOverrides.length > 0) overrides.leagueGroupOverrides = leagueGroupOverrides;
    return simulateMaintenanceAndNet(selectedCycleId, overrides);
  }, [
    simulateOpen,
    canSimulate,
    selectedCycleId,
    simulatedTerahash,
    simulatedUserEnergyEfficiency,
    simulatedPersonalDiscountPercent,
    simulationLeagueGroupValues,
    simulationDefaults?.leagueGroups,
  ]);
  useEffect(() => {
    if (computedSimulated) setLastSimulatedResult(computedSimulated);
  }, [computedSimulated]);
  const simulated = computedSimulated ?? lastSimulatedResult;

  const simulationViewModel = getMinerWarsPanelViewModel({
    data,
    currency: simulateCurrency,
    activeTab: "individual",
    extraFiatCode,
    extraFiatRate,
  });
  const { individualCurrencyOptions: simulateCurrencyOptions } = simulationViewModel;

  useEffect(() => {
    if (!simulateOpen || simulateCurrencyOptions.length === 0) return;
    const isValid = simulateCurrencyOptions.some((option) => option.key === simulateCurrency);
    if (!isValid) setSimulateCurrency(simulateCurrencyOptions[0]!.key);
  }, [simulateCurrency, simulateCurrencyOptions, simulateOpen]);

  function handleSimulateCurrency() {
    if (simulateCurrencyOptions.length === 0) return;
    const index = simulateCurrencyOptions.findIndex((option) => option.key === simulateCurrency);
    const nextIndex = index >= 0 ? (index + 1) % simulateCurrencyOptions.length : 0;
    setSimulateCurrency(simulateCurrencyOptions[nextIndex]!.key);
  }

  const modalProps: MinerWarsSimulateModalProps | null = canSimulate
    ? {
        open: simulateOpen,
        onClose: () => setSimulateOpen(false),
        containerRef: simulateRef,
        simulated,
        viewModel: simulationViewModel,
        onCycleCurrency: handleSimulateCurrency,
        inputs: {
          terahash: simulatedTerahash,
          setTerahash: setSimulatedTerahash,
          userEnergyEfficiency: simulatedUserEnergyEfficiency,
          setUserEnergyEfficiency: setSimulatedUserEnergyEfficiency,
          personalDiscountPercent: simulatedPersonalDiscountPercent,
          setPersonalDiscountPercent: setSimulatedPersonalDiscountPercent,
          leagueGroups: simulationDefaults?.leagueGroups ?? [],
          leagueGroupValues: simulationLeagueGroupValues,
          setLeagueGroupValue: setSimulationLeagueGroupValue,
        },
      }
    : null;

  return { canSimulate, simulateOpen, toggleSimulate, modalProps };
}
