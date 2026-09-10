import { useTranslation } from "react-i18next";
import type { ClanPerformance } from "@/lib/minerwars/clan-performance";
import type { Currency } from "../../types";
import { ClanPerformanceView } from "./clan-performance-view";

interface MinerWarsClanViewProps {
  data: ClanPerformance | null;
  loading: boolean;
  error: string | null;
  clanTargetBtc: number;
  clanMinerWarsBtc: number;
  btcPerBlockSats: number | null;
  targetActualDays: number;
  targetProjectedDays: number;
  currency: Currency;
  fiatCode: string | null;
  extraFiatRate: number | null;
  btcPrice: number | null;
  gmtPrice: number | null;
  isLiveCycle: boolean;
}

export function MinerWarsClanView({
  data,
  loading,
  error,
  clanTargetBtc,
  clanMinerWarsBtc,
  btcPerBlockSats,
  targetActualDays,
  targetProjectedDays,
  currency,
  fiatCode,
  extraFiatRate,
  btcPrice,
  gmtPrice,
  isLiveCycle,
}: MinerWarsClanViewProps) {
  const { t } = useTranslation();

  if (data) {
    return (
      <ClanPerformanceView
        data={data}
        clanTargetBtc={clanTargetBtc}
        clanMinerWarsBtc={clanMinerWarsBtc}
        btcPerBlockSats={btcPerBlockSats}
        targetActualDays={targetActualDays}
        targetProjectedDays={targetProjectedDays}
        currency={currency}
        fiatCode={fiatCode}
        extraFiatRate={extraFiatRate}
        btcPrice={btcPrice}
        gmtPrice={gmtPrice}
        isLiveCycle={isLiveCycle}
      />
    );
  }

  if (loading) return <div className="clan-view-empty">{t("cycleTracker.computingClan")}</div>;
  if (error) return <div className="clan-view-empty">{error}</div>;
  return <div className="clan-view-empty">{t("cycleTracker.clanNoData")}</div>;
}
