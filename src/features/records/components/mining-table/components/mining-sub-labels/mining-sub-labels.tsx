import { useTranslation } from "react-i18next";
import type { Currency } from "@/features/records/types";
import { TrendArrow } from "@/features/records/components/table-cell-utils/table-cell-utils";

export interface MiningRow {
  date: string;
  rowId: string;
  poolReward: number;
  maintenance: number;
  reward: number;
  totalPower: number;
  efficiency?: number;
  discount: number;
  satsPerTerahash?: number;
  btcPriceAtTime?: number;
  btcPriceGmt?: number;
  btcPriceFiat?: number;
}

const formatSats = (value: number) =>
  (Math.floor(value * 100) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function pickBtcPrice(row: MiningRow | undefined, currency: Currency) {
  if (currency === "GMT") return row?.btcPriceGmt;
  if (currency === "USD") return row?.btcPriceAtTime;
  if (currency === "FIAT") return row?.btcPriceFiat;
  return undefined;
}

export function PoolRewardSubLabels({
  currency,
  fiatCode,
  row,
  previousRow,
  isDiffDay: isDifferenceDay,
  showTrends,
}: {
  currency: Currency;
  fiatCode: string;
  row: MiningRow;
  previousRow?: MiningRow;
  isDiffDay: boolean;
  showTrends: boolean;
}) {
  const { t } = useTranslation();
  if (!showTrends) return null;

  const priceValue = pickBtcPrice(row, currency);
  const previousPriceValue = pickBtcPrice(previousRow, currency);
  const priceUnit = currency === "FIAT" ? fiatCode : currency === "BTC" ? null : currency;

  return (
    <>
      {priceValue != null && priceUnit && (
        <div className="dv-cell-sub">
          {t("dataViewer.btcPrice")}:{" "}
          {priceValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} {priceUnit}
          <TrendArrow current={priceValue} previous={previousPriceValue} />
        </div>
      )}
      {row.satsPerTerahash != null && (
        <div className="dv-cell-sub">
          Sats/TH: {formatSats(row.satsPerTerahash)} Sats
          {isDifferenceDay && (
            <TrendArrow current={row.satsPerTerahash} previous={previousRow?.satsPerTerahash} />
          )}
        </div>
      )}
    </>
  );
}
