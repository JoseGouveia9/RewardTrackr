import { useTranslation } from "react-i18next";
import { formatCurrencyValue } from "../../utils";
import { AnyCurrencyIcon } from "@/components/icons/currency-icons";
import { TotalCell, ViewIcon } from "../table-cell-utils/table-cell-utils";

export interface CurrencyTotal {
  currency: string;
  value: number;
  unit: string;
}

export function CurrencyTotalsRows({
  totals,
  hiddenCurrencies,
  onToggle,
  cellLabel,
  hasMiddleCell,
  view,
  fiatCode,
  grandTotal,
}: {
  totals: CurrencyTotal[];
  hiddenCurrencies: Set<string>;
  onToggle: (currency: string) => void;
  cellLabel: string;
  hasMiddleCell: boolean;
  view: string;
  fiatCode: string;
  grandTotal: number;
}) {
  const { t } = useTranslation();
  const isSingleCurrency = totals.length === 1;
  const isNative = view === "NATIVE";

  return (
    <>
      {totals.map(({ currency, value, unit }) => (
        <tr
          key={currency}
          className={`${!isSingleCurrency ? "dv-totals-row--clickable" : ""}${hiddenCurrencies.has(currency) ? " dv-totals-row--hidden" : ""}`}
          onClick={isSingleCurrency ? undefined : () => onToggle(currency)}
        >
          <td>
            {isSingleCurrency ? (
              <span className="dv-totals-label">{t("common.total")}</span>
            ) : (
              <span className="dv-totals-currency-cell">
                <AnyCurrencyIcon currency={currency} />
                <span className="dv-totals-currency-label">{currency}</span>
              </span>
            )}
          </td>
          {hasMiddleCell && <td />}
          <td>
            <TotalCell
              label={cellLabel}
              text={formatCurrencyValue(value, unit)}
              icon={
                <ViewIcon
                  view={view}
                  fiatCode={fiatCode}
                  native={<AnyCurrencyIcon currency={currency} />}
                />
              }
            />
          </td>
        </tr>
      ))}
      {!isSingleCurrency && !isNative && (
        <tr className="dv-totals-row--summary">
          <td className="dv-totals-label">{t("common.total")}</td>
          {hasMiddleCell && <td />}
          <td>
            <TotalCell
              text={formatCurrencyValue(grandTotal, view)}
              icon={<ViewIcon view={view} fiatCode={fiatCode} />}
              accent
            />
          </td>
        </tr>
      )}
    </>
  );
}
