import {
  CARD_WIDTH,
  DIVIDER_HEIGHT,
  GAP,
  GRID_BOTTOM,
  GRID_TOP,
  LOGO_SIZE,
  MINING_GROUP_KEYS,
  MINING_ROW_HEIGHT,
  PADDING,
  REWARD_ROW_HEIGHT,
} from "../constants";
import { formatAmount, formatFiat } from "../format";
import { computeCardItemHeight, computeColumnCount, computeTotalHeight } from "../layout";
import type { CardColors, MiningStats, SheetEntry } from "../../types";
import { drawStatBadge } from "./draw-badge";
import { canvasFont, drawAmountWithIcon, ellipsize, fillRoundRect } from "./draw-utils";

/**
 * Draws one sheet tile: label, rewards (or mining pool reward/maintenance/reward rows) and a fiat total.
 * Mining sheets without maintenance show only the pool reward and its fiat value.
 */
function drawSingleCard(
  canvasContext: CanvasRenderingContext2D,
  sheet: SheetEntry,
  cardX: number,
  cardY: number,
  cardWidth: number,
  cardItemHeight: number,
  iconMap: Map<string, HTMLImageElement>,
  fiatCurrency: string,
  colors: CardColors,
  includeMaintenance: boolean,
): void {
  const { ORANGE, CARD_BACKGROUND, WHITE, MUTED, DIM } = colors;
  const textX = cardX + 14;
  const textMaxWidth = cardWidth - 14 - 8;

  fillRoundRect(canvasContext, cardX, cardY, cardWidth, cardItemHeight, 10, CARD_BACKGROUND);
  fillRoundRect(canvasContext, cardX, cardY + 12, 4, cardItemHeight - 24, 2, ORANGE);

  canvasContext.font = canvasFont(11);
  canvasContext.fillStyle = MUTED;
  canvasContext.textAlign = "left";
  canvasContext.fillText(ellipsize(canvasContext, sheet.label, textMaxWidth), textX, cardY + 12);

  const rewardsStartY = cardY + 28;
  const btcIcon = iconMap.get("BTC");

  if (sheet.mining) {
    const mining = sheet.mining;
    if (includeMaintenance) {
      const miningRows: Array<{ label: string; value: number; color: string }> = [
        { label: "Pool Reward", value: mining.poolReward, color: MUTED },
        { label: "Maintenance", value: mining.maintenance, color: "#ef4444" },
        { label: "Reward", value: mining.reward, color: WHITE },
      ];
      for (let rowIndex = 0; rowIndex < miningRows.length; rowIndex++) {
        const item = miningRows[rowIndex];
        const rowY = rewardsStartY + rowIndex * MINING_ROW_HEIGHT;
        const amountFontSize = cardWidth < 160 ? 11 : 13;
        canvasContext.font = canvasFont(10);
        canvasContext.fillStyle = MUTED;
        canvasContext.textAlign = "left";
        canvasContext.fillText(item.label, textX, rowY);
        const valueY = rowY + 14;
        canvasContext.font = canvasFont(amountFontSize, true);
        canvasContext.fillStyle = item.color;
        drawAmountWithIcon(
          canvasContext,
          item.value.toFixed(8),
          btcIcon,
          textX,
          valueY,
          amountFontSize,
          textMaxWidth,
        );
      }
    } else {
      const amountFontSize = cardWidth < 160 ? 12 : 14;
      canvasContext.font = canvasFont(amountFontSize, true);
      canvasContext.fillStyle = WHITE;
      canvasContext.textAlign = "left";
      drawAmountWithIcon(
        canvasContext,
        mining.poolReward.toFixed(8),
        btcIcon,
        textX,
        rewardsStartY,
        amountFontSize,
        textMaxWidth,
      );
    }
  } else {
    for (let rewardIndex = 0; rewardIndex < sheet.rewards.length; rewardIndex++) {
      const reward = sheet.rewards[rewardIndex];
      const rowY = rewardsStartY + rewardIndex * REWARD_ROW_HEIGHT;
      const amountFontSize = cardWidth < 160 ? 12 : 14;
      canvasContext.font = canvasFont(amountFontSize, true);
      canvasContext.fillStyle = WHITE;
      canvasContext.textAlign = "left";
      drawAmountWithIcon(
        canvasContext,
        formatAmount(reward.total, reward.currency),
        iconMap.get(reward.currency),
        textX,
        rowY,
        amountFontSize,
        textMaxWidth,
      );
    }
  }

  const totalFiatValue =
    sheet.mining && !includeMaintenance
      ? fiatCurrency === "USD"
        ? sheet.mining.poolRewardInUSD
        : sheet.mining.poolRewardInFiat
      : fiatCurrency === "USD"
        ? sheet.rewards.reduce((sum, reward) => sum + reward.totalUSD, 0)
        : sheet.rewards.reduce((sum, reward) => sum + reward.totalFiat, 0);
  if (totalFiatValue > 0) {
    canvasContext.font = canvasFont(10);
    canvasContext.fillStyle = DIM;
    canvasContext.textAlign = "left";
    canvasContext.fillText(
      formatFiat(totalFiatValue, fiatCurrency),
      textX,
      cardY + cardItemHeight - 20,
    );
  }
}

/**
 * Renders the whole share card at logical CARD_W width; the caller scales the context for the preview or export.
 * Solo-mining and MinerWars tiles are placed first only when both are present.
 */
export function drawCard(
  canvasContext: CanvasRenderingContext2D,
  sheets: SheetEntry[],
  periodLabel: string,
  alias: string,
  logoImage: HTMLImageElement | null,
  iconMap: Map<string, HTMLImageElement>,
  fiatCurrency: string,
  includeMaintenance: boolean,
  miningStats: MiningStats | null,
): void {
  const canvasWidth = CARD_WIDTH;
  const canvasHeight = computeTotalHeight(sheets, includeMaintenance);

  const ORANGE = "#f7931a";
  const backgroundColor = "#0f0f0f";
  const cardBackgroundColor = "#1a1a1a";
  const WHITE = "#f0f0f0";
  const MUTED = "#888888";
  const DIM = "#555555";
  const DIVIDER = "#1e1e1e";
  const cardColors: CardColors = {
    ORANGE,
    CARD_BACKGROUND: cardBackgroundColor,
    WHITE,
    MUTED,
    DIM,
  };

  canvasContext.textBaseline = "top";

  canvasContext.fillStyle = backgroundColor;
  canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

  canvasContext.fillStyle = ORANGE;
  canvasContext.fillRect(0, 0, canvasWidth, 4);

  let y = PADDING;

  const logoY = y;
  if (logoImage) {
    canvasContext.drawImage(logoImage, PADDING, logoY, LOGO_SIZE, LOGO_SIZE);
  } else {
    const logoCenterX = PADDING + LOGO_SIZE / 2,
      logoCenterY = logoY + LOGO_SIZE / 2,
      logoRadius = LOGO_SIZE / 2 - 1;
    canvasContext.fillStyle = ORANGE;
    canvasContext.beginPath();
    canvasContext.moveTo(logoCenterX, logoCenterY - logoRadius);
    canvasContext.lineTo(logoCenterX + logoRadius, logoCenterY);
    canvasContext.lineTo(logoCenterX, logoCenterY + logoRadius);
    canvasContext.lineTo(logoCenterX - logoRadius, logoCenterY);
    canvasContext.closePath();
    canvasContext.fill();
  }

  const brandX = PADDING + LOGO_SIZE + 8;
  canvasContext.font = canvasFont(20, true);
  canvasContext.textAlign = "left";
  const brandY = logoY + (LOGO_SIZE - 20) / 2;
  canvasContext.fillStyle = WHITE;
  canvasContext.fillText("REWARD", brandX, brandY);
  const rewardW = canvasContext.measureText("REWARD").width;
  canvasContext.fillStyle = ORANGE;
  canvasContext.fillText("TRACKR", brandX + rewardW, brandY);

  if (miningStats || alias) drawStatBadge(canvasContext, alias, miningStats, logoY, cardColors);

  y += LOGO_SIZE + 10;

  canvasContext.font = canvasFont(12);
  canvasContext.fillStyle = MUTED;
  canvasContext.fillText("GoMining Rewards Summary", PADDING, y);

  y += 18;

  canvasContext.font = canvasFont(14, true);
  canvasContext.fillStyle = ORANGE;
  canvasContext.textAlign = "left";
  canvasContext.fillText(periodLabel, PADDING, y);

  y += 34;

  canvasContext.fillStyle = DIVIDER;
  canvasContext.fillRect(PADDING, y, canvasWidth - 2 * PADDING, DIVIDER_HEIGHT);
  y += DIVIDER_HEIGHT + GRID_TOP;

  const miningSheets = sheets.filter((sheet) => MINING_GROUP_KEYS.has(sheet.key));
  const otherSheets = sheets.filter((sheet) => !MINING_GROUP_KEYS.has(sheet.key));
  const hasMiningGroup = miningSheets.length === 2;
  const sortedSheets = hasMiningGroup ? [...miningSheets, ...otherSheets] : sheets;
  const sheetCount = sortedSheets.length;
  const maxRewards = Math.max(1, ...sortedSheets.map((sheet) => sheet.rewards.length));
  const hasMining = sortedSheets.some((sheet) => !!sheet.mining);
  const CARD_ITEM_H = computeCardItemHeight(maxRewards, hasMining, includeMaintenance);
  const columnCount = computeColumnCount(sheetCount);
  const rowCount = Math.ceil(sheetCount / columnCount);
  const cardW = Math.floor((canvasWidth - 2 * PADDING - (columnCount - 1) * GAP) / columnCount);

  for (let index = 0; index < sheetCount; index++) {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const cardX = PADDING + column * (cardW + GAP);
    const cardY = y + row * (CARD_ITEM_H + GAP);
    drawSingleCard(
      canvasContext,
      sortedSheets[index],
      cardX,
      cardY,
      cardW,
      CARD_ITEM_H,
      iconMap,
      fiatCurrency,
      cardColors,
      includeMaintenance,
    );
  }

  y += rowCount * CARD_ITEM_H + Math.max(0, rowCount - 1) * GAP + GRID_BOTTOM;

  canvasContext.fillStyle = DIVIDER;
  canvasContext.fillRect(PADDING, y, canvasWidth - 2 * PADDING, DIVIDER_HEIGHT);
  y += DIVIDER_HEIGHT;

  canvasContext.font = canvasFont(10);
  canvasContext.fillStyle = DIM;
  canvasContext.textAlign = "left";
  canvasContext.fillText("rewardtrackr.com", PADDING, y + 13);

  canvasContext.textAlign = "right";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  canvasContext.fillText(`Generated ${todayLabel}`, canvasWidth - PADDING, y + 13);
}
