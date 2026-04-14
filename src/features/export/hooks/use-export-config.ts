import { useCallback, useEffect, useMemo, useReducer } from "react";
import { ALL_REWARD_KEYS } from "../config/reward-configs";
import { WALLET_TX_KEYS } from "../config/wallet-types";
import { LS_KEY_EXPORT_CONFIG } from "@/lib/storage-keys";
import type { ExtraFiatCurrency, RewardGroup, RewardKey } from "../types";

// Types

interface ExportConfigState {
  selectedKeys: RewardKey[];
  selectedTxFromTypes: string[];
  includeWalletFiat: boolean;
  includeExcelFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
}

type ExportConfigAction =
  | { type: "TOGGLE_GROUP"; group: RewardGroup }
  | { type: "TOGGLE_ALL" }
  | { type: "TOGGLE_TX_TYPE"; fromTypes: string[]; checked: boolean }
  | { type: "SET_INCLUDE_WALLET_FIAT"; checked: boolean }
  | { type: "SET_INCLUDE_EXCEL_FIAT"; checked: boolean }
  | { type: "SET_FIAT_CURRENCY"; currency: ExtraFiatCurrency }
  | { type: "RESET" };

// Initial state & helpers

const initialState: ExportConfigState = {
  selectedKeys: [],
  selectedTxFromTypes: [],
  includeWalletFiat: false,
  includeExcelFiat: false,
  excelFiatCurrency: "EUR",
};

// Loads the persisted export configuration from localStorage, falling back to initialState.
function loadSavedConfig(): ExportConfigState {
  try {
    const raw = localStorage.getItem(LS_KEY_EXPORT_CONFIG);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<ExportConfigState>;
    return {
      selectedKeys: Array.isArray(parsed.selectedKeys) ? (parsed.selectedKeys as RewardKey[]) : [],
      selectedTxFromTypes: Array.isArray(parsed.selectedTxFromTypes)
        ? parsed.selectedTxFromTypes
        : [],
      includeWalletFiat:
        typeof parsed.includeWalletFiat === "boolean" ? parsed.includeWalletFiat : false,
      includeExcelFiat:
        typeof parsed.includeExcelFiat === "boolean" ? parsed.includeExcelFiat : false,
      excelFiatCurrency:
        typeof parsed.excelFiatCurrency === "string"
          ? (parsed.excelFiatCurrency as ExtraFiatCurrency)
          : "EUR",
    };
  } catch {
    return initialState;
  }
}

// Pure reducer for all export-configuration state transitions.
function exportConfigReducer(
  state: ExportConfigState,
  action: ExportConfigAction,
): ExportConfigState {
  switch (action.type) {
    case "TOGGLE_GROUP": {
      const allSelected = action.group.keys.every((k) => state.selectedKeys.includes(k));
      return {
        ...state,
        selectedKeys: allSelected
          ? state.selectedKeys.filter((k) => !action.group.keys.includes(k))
          : [...new Set([...state.selectedKeys, ...action.group.keys])],
      };
    }
    case "TOGGLE_ALL":
      return {
        ...state,
        selectedKeys:
          state.selectedKeys.length === ALL_REWARD_KEYS.length ? [] : [...ALL_REWARD_KEYS],
      };
    case "TOGGLE_TX_TYPE":
      return {
        ...state,
        selectedTxFromTypes: action.checked
          ? [...new Set([...state.selectedTxFromTypes, ...action.fromTypes])]
          : state.selectedTxFromTypes.filter((ft) => !action.fromTypes.includes(ft)),
      };
    case "SET_INCLUDE_WALLET_FIAT":
      return { ...state, includeWalletFiat: action.checked };
    case "SET_INCLUDE_EXCEL_FIAT":
      return { ...state, includeExcelFiat: action.checked };
    case "SET_FIAT_CURRENCY":
      return { ...state, excelFiatCurrency: action.currency };
    case "RESET":
      return initialState;
  }
}

// Hook

// Manages export configuration state (selected sheets, fiat options, tx filters) with localStorage persistence.
export function useExportConfig() {
  const [state, dispatch] = useReducer(exportConfigReducer, undefined, loadSavedConfig);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_EXPORT_CONFIG, JSON.stringify(state));
    } catch {
      // QuotaExceededError, skip silently
    }
  }, [state]);

  // Returns true if every key in the group is currently selected.
  const isGroupSelected = useCallback(
    (group: RewardGroup): boolean => group.keys.every((k) => state.selectedKeys.includes(k)),
    [state.selectedKeys],
  );

  const walletSheetsSelected = useMemo(
    () => [...WALLET_TX_KEYS].some((k) => state.selectedKeys.includes(k)),
    [state.selectedKeys],
  );

  const toggleGroup = useCallback((group: RewardGroup): void => {
    dispatch({ type: "TOGGLE_GROUP", group });
  }, []);

  const toggleAll = useCallback((): void => {
    dispatch({ type: "TOGGLE_ALL" });
  }, []);

  const toggleTxType = useCallback((fromTypes: string[], checked: boolean): void => {
    dispatch({ type: "TOGGLE_TX_TYPE", fromTypes, checked });
  }, []);

  const setIncludeWalletFiat = useCallback((checked: boolean): void => {
    dispatch({ type: "SET_INCLUDE_WALLET_FIAT", checked });
  }, []);

  const setIncludeExcelFiat = useCallback((checked: boolean): void => {
    dispatch({ type: "SET_INCLUDE_EXCEL_FIAT", checked });
  }, []);

  const setFiatCurrency = useCallback((currency: ExtraFiatCurrency): void => {
    dispatch({ type: "SET_FIAT_CURRENCY", currency });
  }, []);

  const resetConfig = useCallback((): void => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    ...state,
    isGroupSelected,
    walletSheetsSelected,
    toggleGroup,
    toggleAll,
    toggleTxType,
    setIncludeWalletFiat,
    setIncludeExcelFiat,
    setFiatCurrency,
    resetConfig,
  };
}
