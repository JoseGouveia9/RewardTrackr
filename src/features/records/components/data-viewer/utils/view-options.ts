import type {
  Currency,
  EarnView,
  PurchaseView,
  SimpleView,
  TransactionView,
  ViewKey,
} from "@/features/records/types";
import type { TabKind, ViewSelectorConfig } from "../types";

export interface RecordsViewInfo {
  currencies: string[];
  hasUsd: boolean;
  hasFiat: boolean;
}

export interface ViewOptions {
  currencies: { key: Currency; label: string }[];
  earnViews: { key: EarnView; label: string }[];
  transactionViews: { key: TransactionView; label: string }[];
  purchaseViews: { key: PurchaseView; label: string }[];
  simpleViews: { key: SimpleView; label: string }[];
  showTransactionSelector: boolean;
  showSimpleSelector: boolean;
}

export interface EffectiveViews {
  earn: EarnView;
  transaction: TransactionView;
  purchase: PurchaseView;
  simple: SimpleView;
}

/**
 * Builds the selector options per table; USD/fiat entries for transactions and simple tables
 * appear only if data has them.
 */
export function buildViewOptions(
  fiatCode: string,
  transactionInfo: RecordsViewInfo,
  simpleInfo: RecordsViewInfo,
): ViewOptions {
  const nativeLabel = simpleInfo.currencies.length === 1 ? simpleInfo.currencies[0] : "Native";
  return {
    currencies: [
      { key: "BTC", label: "BTC" },
      { key: "GMT", label: "GMT" },
      { key: "USD", label: "USD" },
      { key: "FIAT", label: fiatCode },
    ],
    earnViews: [
      { key: "NATIVE", label: "BTC" },
      { key: "USD", label: "USD" },
      { key: "FIAT", label: fiatCode },
    ],
    transactionViews: [
      { key: "GMT", label: "GMT" },
      ...(transactionInfo.hasUsd ? [{ key: "USD" as TransactionView, label: "USD" }] : []),
      ...(transactionInfo.hasFiat ? [{ key: "FIAT" as TransactionView, label: fiatCode }] : []),
    ],
    purchaseViews: [
      { key: "NATIVE", label: "Native" },
      { key: "USD", label: "USD" },
      { key: "FIAT", label: fiatCode },
    ],
    simpleViews: [
      { key: "NATIVE", label: nativeLabel },
      ...(simpleInfo.hasUsd ? [{ key: "USD" as SimpleView, label: "USD" }] : []),
      ...(simpleInfo.hasFiat ? [{ key: "FIAT" as SimpleView, label: fiatCode }] : []),
    ],
    showTransactionSelector: transactionInfo.hasUsd || transactionInfo.hasFiat,
    showSimpleSelector: simpleInfo.hasUsd || simpleInfo.hasFiat,
  };
}

/**
 * Maps the shared view to each table, falling back to GMT (transactions) or NATIVE (simple) when
 * USD/fiat data is missing.
 */
export function resolveEffectiveViews(
  sharedView: ViewKey,
  transactionInfo: RecordsViewInfo,
  simpleInfo: RecordsViewInfo,
): EffectiveViews {
  const transaction: TransactionView =
    sharedView === "USD" && !transactionInfo.hasUsd
      ? "GMT"
      : sharedView === "FIAT" && !transactionInfo.hasFiat
        ? "GMT"
        : sharedView === "NATIVE"
          ? "GMT"
          : sharedView;
  const simple: SimpleView =
    sharedView === "USD" && !simpleInfo.hasUsd
      ? "NATIVE"
      : sharedView === "FIAT" && !simpleInfo.hasFiat
        ? "NATIVE"
        : sharedView;
  return { earn: sharedView, transaction, purchase: sharedView, simple };
}

/** Wraps typed selector data as a `ViewSelectorConfig`; keys always come from `views`, so the cast is safe. */
export function toSelector<K extends string>(
  views: { key: K; label: string }[],
  active: K,
  onSelect: (key: K) => void,
): ViewSelectorConfig {
  return { views, active, onSelect: onSelect as (key: string) => void };
}

/** Selector for the active non-mining tab, or null when that tab has none to show. */
export function resolveTabViewSelector(
  kind: TabKind,
  options: ViewOptions,
  effective: EffectiveViews,
  onSelect: (view: ViewKey) => void,
): ViewSelectorConfig | null {
  switch (kind) {
    case "earn":
      return toSelector(options.earnViews, effective.earn, onSelect);
    case "tx":
      return options.showTransactionSelector
        ? toSelector(options.transactionViews, effective.transaction, (key) =>
            onSelect(key === "GMT" ? "NATIVE" : key),
          )
        : null;
    case "purchase":
      return toSelector(options.purchaseViews, effective.purchase, onSelect);
    case "simple":
      return options.showSimpleSelector
        ? toSelector(options.simpleViews, effective.simple, onSelect)
        : null;
    default:
      return null;
  }
}
