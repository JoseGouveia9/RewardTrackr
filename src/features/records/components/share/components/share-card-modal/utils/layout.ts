import {
  CARD_BASE_HEIGHT,
  CARD_WIDTH,
  DIVIDER_HEIGHT,
  FOOTER_HEIGHT,
  GAP,
  GRID_BOTTOM,
  GRID_TOP,
  HEADER_HEIGHT,
  MINING_ROW_HEIGHT,
  PADDING,
  PADDING_BOTTOM,
  REWARD_ROW_HEIGHT,
} from "./constants";
import type { SheetEntry } from "../types";

/** Single row unless cards would drop below ~130px wide, then two rows */
export function computeColumnCount(cardCount: number): number {
  if (cardCount <= 0) return 1;
  const available = CARD_WIDTH - 2 * PADDING;
  const singleRowWidth = (available - (cardCount - 1) * GAP) / cardCount;
  if (singleRowWidth >= 130) return cardCount;
  return Math.ceil(cardCount / 2);
}

/**
 * Tile height driven by the larger of the reward rows or the mining block (3 rows with
 * maintenance).
 */
export function computeCardItemHeight(
  maxRewards: number,
  hasMining: boolean,
  includeMaintenance: boolean,
): number {
  const miningHeight = hasMining
    ? includeMaintenance
      ? 3 * MINING_ROW_HEIGHT
      : REWARD_ROW_HEIGHT
    : 0;
  const normalHeight = Math.max(1, maxRewards) * REWARD_ROW_HEIGHT;
  return CARD_BASE_HEIGHT + Math.max(normalHeight, miningHeight);
}

/** Total canvas height: header, footer and the card grid sized by the tallest sheet. */
export function computeTotalHeight(sheets: SheetEntry[], includeMaintenance: boolean): number {
  const sheetCount = sheets.length;
  if (sheetCount === 0)
    return (
      PADDING +
      HEADER_HEIGHT +
      DIVIDER_HEIGHT +
      GRID_TOP +
      GRID_BOTTOM +
      DIVIDER_HEIGHT +
      FOOTER_HEIGHT +
      PADDING_BOTTOM
    );
  const maxRewardCount = Math.max(1, ...sheets.map((sheet) => sheet.rewards.length));
  const hasMining = sheets.some((sheet) => !!sheet.mining);
  const itemHeight = computeCardItemHeight(maxRewardCount, hasMining, includeMaintenance);
  const columns = computeColumnCount(sheetCount);
  const rows = Math.ceil(sheetCount / columns);
  const gridHeight = rows * itemHeight + Math.max(0, rows - 1) * GAP;
  return (
    PADDING +
    HEADER_HEIGHT +
    DIVIDER_HEIGHT +
    GRID_TOP +
    gridHeight +
    GRID_BOTTOM +
    DIVIDER_HEIGHT +
    FOOTER_HEIGHT +
    PADDING_BOTTOM
  );
}
