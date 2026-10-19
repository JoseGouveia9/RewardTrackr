import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type {
  MinerWarsClanCurrencyMode,
  MinerWarsIndividualCurrencyMode,
  MinerWarsShareScope,
  MinerWarsShareSnapshot,
} from "../../types/share-types";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import { CloseIcon } from "@/components/icons";
import { useShareImageDownload } from "./hooks/use-share-image-download";
import { useStageScale } from "./hooks/use-stage-scale";
import { DualCurrencyIcon } from "../comparison-panel/components/minerwars-panel-parts/minerwars-panel-parts";
import { nextEnabledMode } from "./utils/next-enabled-mode";
import { ShareSwitchRow } from "./components/share-switch-row/share-switch-row";
import { MinerWarsShareCard } from "./components/share-card/minerwars-share-card";
import "./minerwars-share-modal.css";

const CARD_WIDTH = 1080;
const INDIVIDUAL_MODE_ORDER: MinerWarsIndividualCurrencyMode[] = ["btc", "gmt", "usd", "extra"];
const CLAN_MODE_ORDER: MinerWarsClanCurrencyMode[] = ["native", "gmt", "usd", "extra"];

function defaultScope(snapshot: MinerWarsShareSnapshot): MinerWarsShareScope {
  const hasIndividual = snapshot.comparison != null;
  const hasClan = snapshot.clanPerformance != null;
  if (snapshot.currentViewMode === "clan" && hasClan) return hasIndividual ? "both" : "clan";
  if (hasIndividual) return hasClan ? "both" : "individual";
  return "clan";
}

function modeIcon(mode: string, extraCode: string | null | undefined, base: ReactNode): ReactNode {
  if (mode === "gmt") return <GmtIcon />;
  if (mode === "usd") return <UsdIcon />;
  if (mode === "extra") return <FiatIcon code={extraCode ?? "USD"} />;
  return base;
}

export function MinerWarsShareModal({
  open,
  snapshot,
  onClose,
}: {
  open: boolean;
  snapshot: MinerWarsShareSnapshot | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [scope, setScope] = useState<MinerWarsShareScope>("individual");
  const [individualMode, setIndividualMode] = useState<MinerWarsIndividualCurrencyMode>("btc");
  const [clanMode, setClanMode] = useState<MinerWarsClanCurrencyMode>("native");
  const [showLeague, setShowLeague] = useState(true);
  const [showClanName, setShowClanName] = useState(true);
  const [showTrendChart, setShowTrendChart] = useState(true);
  const [showPersonalRow, setShowPersonalRow] = useState(true);
  const [light, setLight] = useState(true);
  const [cardHeight, setCardHeight] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const { stageRef, scale } = useStageScale(open, CARD_WIDTH);
  const { generating, handleDownload } = useShareImageDownload({
    cardRef,
    light,
    cycleId: snapshot?.selectedCycleId,
  });

  const hasIndividual = snapshot?.comparison != null;
  const hasClan = snapshot?.clanPerformance != null;

  const generatedFooter = useMemo(
    () =>
      new Date().toLocaleDateString(i18n.language, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [i18n.language],
  );

  useEffect(() => {
    if (!open || !snapshot) return;
    setScope(defaultScope(snapshot));
    setIndividualMode("btc");
    setClanMode("native");
    setShowLeague(true);
    setShowClanName(true);
    setShowTrendChart(true);
    setShowPersonalRow(true);
    const themeDark = document.querySelector(".page")?.classList.contains("theme-dark");
    setLight(!themeDark);
  }, [open, snapshot]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const update = () => setCardHeight(node.offsetHeight);
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [
    open,
    scope,
    individualMode,
    clanMode,
    showLeague,
    showClanName,
    showTrendChart,
    showPersonalRow,
    light,
    snapshot,
  ]);

  const canShowGmt = Boolean(
    snapshot?.comparison &&
    (snapshot.comparison.gmtPrice ?? 0) > 0 &&
    (snapshot.comparison.btcPrice ?? 0) > 0,
  );
  const canShowUsd = Boolean(
    snapshot?.comparison &&
    ((snapshot.comparison.btcPrice ?? 0) > 0 || snapshot.comparison.minerWarsUsd != null),
  );
  const canShowExtra = Boolean(
    canShowUsd && snapshot?.extraFiatCode && snapshot?.extraFiatRate != null,
  );

  const canShare =
    (scope === "individual" && hasIndividual) ||
    (scope === "clan" && hasClan) ||
    (scope === "both" && hasIndividual && hasClan);

  const isModeEnabled = useCallback(
    (mode: string) =>
      mode === "btc" ||
      mode === "native" ||
      (mode === "gmt" && canShowGmt) ||
      (mode === "usd" && canShowUsd) ||
      (mode === "extra" && canShowExtra),
    [canShowGmt, canShowUsd, canShowExtra],
  );

  const cycleIndividualMode = useCallback(() => {
    setIndividualMode((mode) => nextEnabledMode(INDIVIDUAL_MODE_ORDER, mode, isModeEnabled));
  }, [isModeEnabled]);

  const cycleClanMode = useCallback(() => {
    setClanMode((mode) => nextEnabledMode(CLAN_MODE_ORDER, mode, isModeEnabled));
  }, [isModeEnabled]);

  if (!open || !snapshot) return null;

  const scopeOptions: Array<{ key: MinerWarsShareScope; label: string; enabled: boolean }> = [
    {
      key: "individual",
      label: t("minerwars.individual", { defaultValue: "Individual" }),
      enabled: hasIndividual,
    },
    { key: "clan", label: t("minerwars.clan", { defaultValue: "Clan" }), enabled: hasClan },
    {
      key: "both",
      label: t("minerwarsShare.both", { defaultValue: "Both" }),
      enabled: hasIndividual && hasClan,
    },
  ];
  const showIndividualControls = hasIndividual && (scope === "individual" || scope === "both");
  const showClanControls = hasClan && (scope === "clan" || scope === "both");

  return createPortal(
    <div className="mwsm-overlay" onClick={onClose}>
      <div className="mwsm-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mwsm-header">
          <span className="mwsm-title">
            {t("minerwarsShare.title", { defaultValue: "Share MinerWars" })}
          </span>
          <button
            type="button"
            className="mwsm-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mwsm-body">
          <p className="mwsm-subtitle">
            {t("minerwarsShare.subtitle", {
              defaultValue: "Share a snapshot of your MinerWars cycle performance.",
            })}
          </p>

          <div className="mwsm-controls">
            <div className="mwsm-scope-row">
              {scopeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`mwsm-scope-chip${scope === option.key && option.enabled ? " mwsm-scope-chip--on" : ""}${!option.enabled ? " mwsm-scope-chip--disabled" : ""}`}
                  onClick={() => option.enabled && setScope(option.key)}
                  disabled={!option.enabled}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mwsm-currency-row">
              {showIndividualControls && (
                <div className="mwsm-currency-group">
                  <span className="mwsm-control-label">
                    {t("minerwarsShare.individualCurrency", {
                      defaultValue: "Individual currency",
                    })}
                  </span>
                  <button type="button" className="mwsm-icon-btn" onClick={cycleIndividualMode}>
                    {modeIcon(individualMode, snapshot.extraFiatCode, <DualCurrencyIcon />)}
                  </button>
                </div>
              )}
              {showClanControls && (
                <div className="mwsm-currency-group">
                  <span className="mwsm-control-label">
                    {t("minerwarsShare.clanPerformanceCurrency", { defaultValue: "Clan currency" })}
                  </span>
                  <button type="button" className="mwsm-icon-btn" onClick={cycleClanMode}>
                    {modeIcon(clanMode, snapshot.extraFiatCode, <BtcIcon />)}
                  </button>
                </div>
              )}
            </div>

            {showClanControls && (
              <ShareSwitchRow
                label={t("minerwarsShare.leagueTag", { defaultValue: "League tag" })}
                checked={showLeague}
                onChange={setShowLeague}
              />
            )}
            {showClanControls && (
              <ShareSwitchRow
                label={t("minerwarsShare.clanName", { defaultValue: "Clan name" })}
                checked={showClanName}
                onChange={setShowClanName}
              />
            )}
            {showIndividualControls && (
              <ShareSwitchRow
                label={t("minerwarsShare.trendChart", { defaultValue: "Trend chart" })}
                checked={showTrendChart}
                onChange={setShowTrendChart}
              />
            )}
            {showIndividualControls && (
              <ShareSwitchRow
                label={t("minerwarsShare.personalRewardRow", {
                  defaultValue: "Personal GMT/Boost/Net",
                })}
                checked={showPersonalRow}
                onChange={setShowPersonalRow}
              />
            )}
            <ShareSwitchRow
              label={t("shareImage.lightImage", { defaultValue: "Light image" })}
              checked={light}
              onChange={setLight}
            />
          </div>

          <div className="mwsm-preview">
            <span className="mwsm-preview-title">
              {t("dataViewer.preview", { defaultValue: "Preview" })}
            </span>
            {canShare ? (
              <div className="mwsm-stage" ref={stageRef}>
                <div
                  className="mwsm-stage-inner"
                  style={{
                    transform: `scale(${scale})`,
                    height: cardHeight > 0 ? cardHeight * scale : undefined,
                  }}
                >
                  <MinerWarsShareCard
                    ref={cardRef}
                    snapshot={snapshot}
                    scope={scope}
                    currencyModes={{ individual: individualMode, clan: clanMode }}
                    visibility={{
                      league: showLeague,
                      clanName: showClanName,
                      trendChart: showTrendChart,
                      personalRow: showPersonalRow,
                    }}
                    light={light}
                    generatedFooter={generatedFooter}
                  />
                </div>
              </div>
            ) : (
              <div className="mwsm-preview-empty">
                {t("minerwarsShare.nothingToShare", {
                  defaultValue: "No data available for this selection.",
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mwsm-footer">
          <button type="button" className="mwsm-btn mwsm-btn-cancel" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="mwsm-btn mwsm-btn-download"
            onClick={() => void handleDownload()}
            disabled={!canShare || generating}
          >
            {generating
              ? t("minerwarsShare.generating", { defaultValue: "Generating…" })
              : t("shareImage.downloadPng", { defaultValue: "Download PNG" })}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
