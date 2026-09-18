import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toPng } from "html-to-image";
import type {
  MinerWarsClanCurrencyMode,
  MinerWarsIndividualCurrencyMode,
  MinerWarsShareScope,
  MinerWarsShareSnapshot,
} from "./minerwars-share-types";
import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "../icons/currency-icons";
import { CloseIcon } from "../icons";
import { DualCurrencyIcon } from "./minerwars-panel-parts";
import { MinerWarsShareCard } from "./minerwars-share-card";
import "./minerwars-share-modal.css";

const CARD_WIDTH = 1080;

function defaultScope(snapshot: MinerWarsShareSnapshot): MinerWarsShareScope {
  const hasIndividual = snapshot.comparison != null;
  const hasClan = snapshot.clanPerformance != null;
  if (snapshot.currentViewMode === "clan" && hasClan) return hasIndividual ? "both" : "clan";
  if (hasIndividual) return hasClan ? "both" : "individual";
  return "clan";
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
  const [generating, setGenerating] = useState(false);
  const [scale, setScale] = useState(0.4);
  const [cardHeight, setCardHeight] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fit the 1080px card into the available preview width via CSS transform.
  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(Math.min(1, w / CARD_WIDTH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  // Track the natural card height so the scaled preview reserves the right space.
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const update = () => setCardHeight(node.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
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

  const cycleIndividualMode = useCallback(() => {
    const order: MinerWarsIndividualCurrencyMode[] = ["btc", "gmt", "usd", "extra"];
    const enabled = (m: MinerWarsIndividualCurrencyMode) =>
      m === "btc" ||
      (m === "gmt" && canShowGmt) ||
      (m === "usd" && canShowUsd) ||
      (m === "extra" && canShowExtra);
    setIndividualMode((mode) => {
      let idx = order.indexOf(mode);
      for (let step = 0; step < order.length; step += 1) {
        idx = (idx + 1) % order.length;
        if (enabled(order[idx])) return order[idx];
      }
      return "btc";
    });
  }, [canShowGmt, canShowUsd, canShowExtra]);

  const cycleClanMode = useCallback(() => {
    const order: MinerWarsClanCurrencyMode[] = ["native", "gmt", "usd", "extra"];
    const enabled = (m: MinerWarsClanCurrencyMode) =>
      m === "native" ||
      (m === "gmt" && canShowGmt) ||
      (m === "usd" && canShowUsd) ||
      (m === "extra" && canShowExtra);
    setClanMode((mode) => {
      let idx = order.indexOf(mode);
      for (let step = 0; step < order.length; step += 1) {
        idx = (idx + 1) % order.length;
        if (enabled(order[idx])) return order[idx];
      }
      return "native";
    });
  }, [canShowGmt, canShowUsd, canShowExtra]);

  const individualIcon =
    individualMode === "gmt" ? (
      <GmtIcon />
    ) : individualMode === "usd" ? (
      <UsdIcon />
    ) : individualMode === "extra" ? (
      <FiatIcon code={snapshot?.extraFiatCode ?? "USD"} />
    ) : (
      <DualCurrencyIcon />
    );
  const clanIcon =
    clanMode === "gmt" ? (
      <GmtIcon />
    ) : clanMode === "usd" ? (
      <UsdIcon />
    ) : clanMode === "extra" ? (
      <FiatIcon code={snapshot?.extraFiatCode ?? "USD"} />
    ) : (
      <BtcIcon />
    );

  const handleDownload = useCallback(async () => {
    const node = cardRef.current;
    if (!node || generating) return;
    setGenerating(true);
    try {
      // Capture the 1080px card node directly (its parent's preview transform doesn't
      // affect the clone html-to-image renders). pixelRatio 2 for a crisp export.
      const opts = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: light ? "#ffffff" : "#0f0f0f",
      };
      let dataUrl: string;
      try {
        dataUrl = await toPng(node, opts);
      } catch {
        // Cross-origin avatars/logos can taint the canvas — retry once without images
        // so the user still gets a share PNG (fallback avatars render instead).
        dataUrl = await toPng(node, {
          ...opts,
          filter: (el) => !(el instanceof HTMLImageElement),
        });
      }
      const a = document.createElement("a");
      a.download = `minerwars-cycle-${snapshot?.selectedCycleId ?? "latest"}.png`;
      a.href = dataUrl;
      a.click();
    } finally {
      setGenerating(false);
    }
  }, [generating, light, snapshot?.selectedCycleId]);

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

  return createPortal(
    <div className="mwsm-overlay" onClick={onClose}>
      <div className="mwsm-modal" onClick={(e) => e.stopPropagation()}>
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
              {scopeOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`mwsm-scope-chip${scope === opt.key && opt.enabled ? " mwsm-scope-chip--on" : ""}${!opt.enabled ? " mwsm-scope-chip--disabled" : ""}`}
                  onClick={() => opt.enabled && setScope(opt.key)}
                  disabled={!opt.enabled}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mwsm-currency-row">
              {hasIndividual && (scope === "individual" || scope === "both") && (
                <div className="mwsm-currency-group">
                  <span className="mwsm-control-label">
                    {t("minerwarsShare.individualCurrency", {
                      defaultValue: "Individual currency",
                    })}
                  </span>
                  <button type="button" className="mwsm-icon-btn" onClick={cycleIndividualMode}>
                    {individualIcon}
                  </button>
                </div>
              )}
              {hasClan && (scope === "clan" || scope === "both") && (
                <div className="mwsm-currency-group">
                  <span className="mwsm-control-label">
                    {t("minerwarsShare.clanPerformanceCurrency", { defaultValue: "Clan currency" })}
                  </span>
                  <button type="button" className="mwsm-icon-btn" onClick={cycleClanMode}>
                    {clanIcon}
                  </button>
                </div>
              )}
            </div>

            {hasClan && (scope === "clan" || scope === "both") && (
              <label className="mwsm-switch-row">
                <span className="mwsm-control-label">
                  {t("minerwarsShare.leagueTag", { defaultValue: "League tag" })}
                </span>
                <input
                  type="checkbox"
                  className="mwsm-switch"
                  checked={showLeague}
                  onChange={(e) => setShowLeague(e.target.checked)}
                />
              </label>
            )}

            {hasClan && (scope === "clan" || scope === "both") && (
              <label className="mwsm-switch-row">
                <span className="mwsm-control-label">
                  {t("minerwarsShare.clanName", { defaultValue: "Clan name" })}
                </span>
                <input
                  type="checkbox"
                  className="mwsm-switch"
                  checked={showClanName}
                  onChange={(e) => setShowClanName(e.target.checked)}
                />
              </label>
            )}

            {hasIndividual && (scope === "individual" || scope === "both") && (
              <label className="mwsm-switch-row">
                <span className="mwsm-control-label">
                  {t("minerwarsShare.trendChart", { defaultValue: "Trend chart" })}
                </span>
                <input
                  type="checkbox"
                  className="mwsm-switch"
                  checked={showTrendChart}
                  onChange={(e) => setShowTrendChart(e.target.checked)}
                />
              </label>
            )}

            {hasIndividual && (scope === "individual" || scope === "both") && (
              <label className="mwsm-switch-row">
                <span className="mwsm-control-label">
                  {t("minerwarsShare.personalRewardRow", {
                    defaultValue: "Personal GMT/Boost/Net",
                  })}
                </span>
                <input
                  type="checkbox"
                  className="mwsm-switch"
                  checked={showPersonalRow}
                  onChange={(e) => setShowPersonalRow(e.target.checked)}
                />
              </label>
            )}

            <label className="mwsm-switch-row">
              <span className="mwsm-control-label">
                {t("shareImage.lightImage", { defaultValue: "Light image" })}
              </span>
              <input
                type="checkbox"
                className="mwsm-switch"
                checked={light}
                onChange={(e) => setLight(e.target.checked)}
              />
            </label>
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
                    individualMode={individualMode}
                    clanMode={clanMode}
                    showLeague={showLeague}
                    showClanName={showClanName}
                    showTrendChart={showTrendChart}
                    showPersonalRow={showPersonalRow}
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
