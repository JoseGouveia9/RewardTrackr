import { useCallback, useEffect, useMemo, useReducer } from "react";
import { ALL_REWARD_KEYS } from "@/config/reward-configs";
import { WALLET_TRANSACTION_KEYS } from "@/config/wallet-types";
import { LOCAL_STORAGE_KEY_EXPORT_CONFIG } from "@/lib/storage-keys";
import type { ExtraFiatCurrency, RewardGroup, RewardKey } from "@/types/rewards";

interface ExportConfigState {
  selectedKeys: RewardKey[];
  includeWalletFiat: boolean;
  includeExcelFiat: boolean;
  excelFiatCurrency: ExtraFiatCurrency;
}

type ExportConfigAction =
  | { type: "TOGGLE_GROUP"; group: RewardGroup }
  | { type: "TOGGLE_ALL" }
  | { type: "SET_INCLUDE_WALLET_FIAT"; checked: boolean }
  | { type: "SET_INCLUDE_EXCEL_FIAT"; checked: boolean }
  | { type: "SET_FIAT_CURRENCY"; currency: ExtraFiatCurrency }
  | { type: "RESET" };

const initialState: ExportConfigState = {
  selectedKeys: [],
  includeWalletFiat: false,
  includeExcelFiat: false,
  excelFiatCurrency: "EUR",
};

/**
 * Reads the persisted config, falling back field by field to defaults when stored values are
 * malformed.
 */
function loadSavedConfig(): ExportConfigState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EXPORT_CONFIG);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<ExportConfigState>;
    return {
      selectedKeys: Array.isArray(parsed.selectedKeys) ? (parsed.selectedKeys as RewardKey[]) : [],
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

function exportConfigReducer(
  state: ExportConfigState,
  action: ExportConfigAction,
): ExportConfigState {
  switch (action.type) {
    case "TOGGLE_GROUP": {
      const allSelected = action.group.keys.every((key) => state.selectedKeys.includes(key));
      return {
        ...state,
        selectedKeys: allSelected
          ? state.selectedKeys.filter((key) => !action.group.keys.includes(key))
          : [...new Set([...state.selectedKeys, ...action.group.keys])],
      };
    }
    case "TOGGLE_ALL":
      return {
        ...state,
        selectedKeys:
          state.selectedKeys.length === ALL_REWARD_KEYS.length ? [] : [...ALL_REWARD_KEYS],
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

export type ExportConfig = ReturnType<typeof useExportConfig>;

/** Export selections persisted to localStorage on every change; groups toggle as a whole. */
export function useExportConfig() {
  const [state, dispatch] = useReducer(exportConfigReducer, undefined, loadSavedConfig);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EXPORT_CONFIG, JSON.stringify(state));
      // eslint-disable-next-line no-empty
    } catch {}
  }, [state]);

  const isGroupSelected = useCallback(
    (group: RewardGroup): boolean => group.keys.every((key) => state.selectedKeys.includes(key)),
    [state.selectedKeys],
  );

  const walletSheetsSelected = useMemo(
    () => [...WALLET_TRANSACTION_KEYS].some((key) => state.selectedKeys.includes(key)),
    [state.selectedKeys],
  );

  const toggleGroup = useCallback((group: RewardGroup): void => {
    dispatch({ type: "TOGGLE_GROUP", group });
  }, []);

  const toggleAll = useCallback((): void => {
    dispatch({ type: "TOGGLE_ALL" });
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
    setIncludeWalletFiat,
    setIncludeExcelFiat,
    setFiatCurrency,
    resetConfig,
  };
}
