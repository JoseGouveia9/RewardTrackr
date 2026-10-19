import type { Currency } from "@/features/records/types";
import { Fraction } from "@/features/records/components/table-cell-utils/table-cell-utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Builds the formula explanations (pool reward, maintenance, reward) with rate labels adapted to
 * the selected currency.
 */
export function buildFormulas(t: Translate, currency: Currency, fiatCode: string) {
  const rateLabel = (pair: string) => {
    const [from, to] = pair.split("/");
    return t("dataViewer.rateLabel", { from, to });
  };
  const discount = `${t("dataViewer.discount")}%`;

  const btcLabel =
    currency === "GMT"
      ? rateLabel("GMT/USD")
      : currency === "FIAT"
        ? rateLabel(`${fiatCode}/BTC`)
        : rateLabel("USD/BTC");
  const poolRewardLabel = currency === "GMT" ? rateLabel("GMT/BTC") : btcLabel;

  const usdPerUnit =
    currency === "USD"
      ? null
      : rateLabel(`USD/${currency === "FIAT" ? fiatCode : currency === "GMT" ? "GMT" : "BTC"}`);

  const poolReward = (
    <div className="dv-math-line">
      <span>{t("dataViewer.poolReward")} =</span>
      <Fraction numerator="Sats/TH × TH" denominator="100,000,000" />
      {currency !== "BTC" && <span>× {poolRewardLabel}</span>}
    </div>
  );

  const electricityLine = (
    <div className="dv-math-line">
      <span className="dv-math-var">{t("dataViewer.electricity")}</span>=
      <Fraction
        numerator={`${t("dataViewer.kwhCost")} × 24`}
        denominator={usdPerUnit === null ? "1,000" : `1,000 x ${usdPerUnit}`}
      />
      <span>
        × {t("dataViewer.efficiency")} × TH − {discount}
      </span>
    </div>
  );

  const serviceLine =
    usdPerUnit === null ? (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.service")}</span>= $0.0089 × TH − {discount}
      </div>
    ) : (
      <div className="dv-math-line">
        <span className="dv-math-var">{t("dataViewer.service")}</span>=
        <Fraction numerator="$0.0089" denominator={usdPerUnit} /> × TH − {discount}
      </div>
    );

  const maintenance = (
    <>
      <div className="dv-math-label">{`${t("dataViewer.maintenance")} = ${t("dataViewer.electricity")} + ${t("dataViewer.service")}`}</div>
      <div className="dv-math-sep" />
      {electricityLine}
      {serviceLine}
      <div className="dv-math-sep" />
      <div className="dv-math-note">{t("dataViewer.kwhCostNote")}</div>
      {currency !== "USD" && (
        <div className="dv-math-note">{t("dataViewer.maintenanceUsdNote")}</div>
      )}
    </>
  );

  const reward = (
    <div className="dv-math-line">{`${t("dataViewer.reward")} = ${t("dataViewer.poolReward")} − ${t("dataViewer.maintenance")}`}</div>
  );

  return { poolReward, maintenance, reward };
}
