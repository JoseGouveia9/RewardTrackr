import { useTranslation } from "react-i18next";
import type { ClanPerformance } from "@/features/minerwars/utils/clan-performance";
import { ClanPerformanceView } from "./components/clan-performance-view/clan-performance-view";
import { ClanSkeletonBody } from "../comparison-panel/components/minerwars-panel-parts/minerwars-panel-parts";
import type { ClanCycleFigures, ClanDisplayOptions } from "./types";

interface MinerWarsClanViewProps {
  data: ClanPerformance | null;
  loading: boolean;
  error: string | null;
  figures: ClanCycleFigures;
  display: ClanDisplayOptions;
  isLiveCycle: boolean;
}

export function MinerWarsClanView({
  data,
  loading,
  error,
  figures,
  display,
  isLiveCycle,
}: MinerWarsClanViewProps) {
  const { t } = useTranslation();

  if (loading) return <ClanSkeletonBody />;

  if (data) {
    return (
      <ClanPerformanceView
        data={data}
        figures={figures}
        display={display}
        isLiveCycle={isLiveCycle}
      />
    );
  }

  if (error) return <div className="clan-view-empty">{error}</div>;
  return <div className="clan-view-empty">{t("cycleTracker.clanNoData")}</div>;
}
