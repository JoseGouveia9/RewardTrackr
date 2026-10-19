import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  MinerWarsClanCurrencyMode,
  MinerWarsIndividualCurrencyMode,
  MinerWarsShareScope,
  MinerWarsShareSnapshot,
} from "@/features/minerwars/types/share-types";
import appLogo from "/logo.webp";
import { ClanSnapshot } from "./components/clan-snapshot/clan-snapshot";
import { leagueName } from "./utils/format";
import { IndividualSnapshot } from "./components/individual-snapshot/individual-snapshot";
import "./minerwars-share-card-base.css";
import "./minerwars-share-card-individual.css";
import "./minerwars-share-card-clan.css";

interface CardProps {
  snapshot: MinerWarsShareSnapshot;
  scope: MinerWarsShareScope;
  currencyModes: { individual: MinerWarsIndividualCurrencyMode; clan: MinerWarsClanCurrencyMode };
  visibility: {
    league: boolean;
    clanName: boolean;
    trendChart: boolean;
    personalRow: boolean;
  };
  light: boolean;
  generatedFooter: string;
}

export const MinerWarsShareCard = forwardRef<HTMLDivElement, CardProps>(function MinerWarsShareCard(
  { snapshot, scope, currencyModes, visibility, light, generatedFooter },
  ref,
) {
  const { individual: individualMode, clan: clanMode } = currencyModes;
  const {
    league: showLeague,
    clanName: showClanName,
    trendChart: showTrendChart,
    personalRow: showPersonalRow,
  } = visibility;
  const { t } = useTranslation();
  const comparison = snapshot.comparison;
  const clan = snapshot.clanPerformance;

  const showIndividual = (scope === "individual" || scope === "both") && comparison != null;
  const showClan = (scope === "clan" || scope === "both") && clan != null;

  const clanHeader = clan?.header;
  const useClanBrand = showClanName && clanHeader?.name != null;
  const brandName = useClanBrand ? clanHeader!.name : "REWARDTRACKR";
  const brandLogoUrl = showClanName ? (clanHeader?.logoUrl ?? appLogo) : appLogo;

  return (
    <div ref={ref} className={`mwpc-root${light ? " mwpc-root--light" : " mwpc-root--dark"}`}>
      <div className="mwpc-hero">
        <div className="mwpc-brand-row">
          <div className="mwpc-brand-left">
            <img
              className="mwpc-logo"
              src={brandLogoUrl}
              alt=""
              crossOrigin={showClanName && clanHeader?.logoUrl ? "anonymous" : undefined}
            />
            <div>
              <div className="mwpc-brand-text">
                {useClanBrand ? (
                  brandName
                ) : (
                  <>
                    REWARD
                    <span className="mwpc-brand-text-accent">TRACKR</span>
                  </>
                )}
              </div>
              <div className="mwpc-brand-sub">MINERWARS PERFORMANCE SNAPSHOT</div>
            </div>
          </div>
          <div className="mwpc-brand-tags">
            <span className="mwpc-meta-pill mwpc-meta-pill--primary">
              {snapshot.selectedCycleId != null ? `Cycle #${snapshot.selectedCycleId}` : "Cycle"}
            </span>
            {showClan && showLeague && (
              <span className="mwpc-meta-pill">
                {clan.header.leagueId != null
                  ? `League ${leagueName(clan.header.leagueId)}`
                  : "League —"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mwpc-sections">
        {showIndividual && (
          <IndividualSnapshot
            snapshot={snapshot}
            comparison={comparison}
            individualMode={individualMode}
            showTrendChart={showTrendChart}
            showPersonalRow={showPersonalRow}
            light={light}
          />
        )}
        {showClan && (
          <ClanSnapshot
            snapshot={snapshot}
            clan={clan}
            comparison={comparison}
            clanMode={clanMode}
            light={light}
          />
        )}
      </div>

      <div className="mwpc-footer">
        <span className="mwpc-footer-text">rewardtrackr.com</span>
        <span className="mwpc-footer-text">
          {t("minerwarsShare.generatedOn", {
            date: generatedFooter,
            defaultValue: `Generated ${generatedFooter}`,
          })}
        </span>
      </div>
    </div>
  );
});
