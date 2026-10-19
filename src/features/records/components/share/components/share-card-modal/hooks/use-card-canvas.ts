import { useCallback, useEffect, useRef, useState } from "react";
import { preloadCardAssets } from "../utils/canvas/assets";
import { drawCard } from "../utils/canvas/draw-card";
import { CARD_WIDTH } from "../utils/constants";
import { computeTotalHeight } from "../utils/layout";
import type { MiningStats, SheetEntry } from "../types";

interface CardCanvasInput {
  sheetData: SheetEntry[];
  periodLabel: string;
  alias: string;
  fiatDisplay: string;
  includeMaintenance: boolean;
  miningStats: MiningStats | null;
}

/**
 * Draws the live preview scaled to its container and exposes a PNG download (at least 2x DPR).
 * Redraws once fonts and icons are preloaded; stale draws are cancelled.
 */
export function useCardCanvas({
  sheetData,
  periodLabel,
  alias,
  fiatDisplay,
  includeMaintenance,
  miningStats,
}: CardCanvasInput) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (sheetData.length === 0) return;
    let cancelled = false;
    const currencies = sheetData.flatMap((sheet) => sheet.rewards.map((reward) => reward.currency));
    void preloadCardAssets(currencies).then(({ logoImage, iconMap }) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const PREVIEW_W = (previewRef.current?.clientWidth ?? 680) - 2;
      const canvasHeight = computeTotalHeight(sheetData, includeMaintenance);
      const scale = PREVIEW_W / CARD_WIDTH;
      const previewH = Math.round(canvasHeight * scale);
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = PREVIEW_W * devicePixelRatio;
      canvas.height = previewH * devicePixelRatio;
      canvas.style.width = `${PREVIEW_W}px`;
      canvas.style.height = `${previewH}px`;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) return;
      canvasContext.setTransform(1, 0, 0, 1, 0, 0);
      canvasContext.scale(devicePixelRatio * scale, devicePixelRatio * scale);
      drawCard(
        canvasContext,
        sheetData,
        periodLabel,
        alias,
        logoImage,
        iconMap,
        fiatDisplay,
        includeMaintenance,
        miningStats,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [sheetData, periodLabel, alias, fiatDisplay, includeMaintenance, miningStats]);

  const handleDownload = useCallback(async () => {
    if (sheetData.length === 0) return;
    setGenerating(true);
    try {
      const currencies = sheetData.flatMap((sheet) =>
        sheet.rewards.map((reward) => reward.currency),
      );
      const { logoImage, iconMap } = await preloadCardAssets(currencies);
      const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 2);
      const canvasHeight = computeTotalHeight(sheetData, includeMaintenance);
      const canvas = document.createElement("canvas");
      canvas.width = CARD_WIDTH * devicePixelRatio;
      canvas.height = canvasHeight * devicePixelRatio;
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) return;
      canvasContext.scale(devicePixelRatio, devicePixelRatio);
      drawCard(
        canvasContext,
        sheetData,
        periodLabel,
        alias,
        logoImage,
        iconMap,
        fiatDisplay,
        includeMaintenance,
        miningStats,
      );

      await new Promise<void>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve();
            return;
          }
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement("a");
          downloadLink.href = url;
          downloadLink.download = `rewardtrackr-${periodLabel.replace(/\s+/g, "-").toLowerCase()}.png`;
          downloadLink.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, "image/png");
      });
    } finally {
      setGenerating(false);
    }
  }, [sheetData, periodLabel, alias, fiatDisplay, includeMaintenance, miningStats]);

  return { canvasRef, previewRef, generating, handleDownload };
}
