import { CARD_WIDTH, LOGO_SIZE, PADDING } from "../constants";
import { formatTerahash } from "../format";
import type { CardColors, MiningStats } from "../../types";
import { canvasFont, fillRoundRect } from "./draw-utils";

const BADGE_CORNER = 10;
const LABEL_FONT_SIZE = 7;
const VALUE_FONT_SIZE = 12;
const UNIT_FONT_SIZE = 8;
const COLUMN_PADDING = 16;
const BADGE_HEIGHT = LOGO_SIZE + 8;
const BAR_WIDTH = 4;
const BAR_INSET = 10;
const TEXT_GAP = 3;
const BLOCK_HEIGHT = LABEL_FONT_SIZE + TEXT_GAP + VALUE_FONT_SIZE;

interface BadgeColumn {
  label: string;
  value: string;
  unit?: string;
}

/** Width of the unit suffix including its gap, or 0 when there is no unit. */
function measureUnitWidth(
  canvasContext: CanvasRenderingContext2D,
  unit: string | undefined,
): number {
  if (!unit) return 0;
  canvasContext.font = canvasFont(UNIT_FONT_SIZE);
  return canvasContext.measureText(unit).width + 3;
}

/**
 * Draws the right-aligned badge beside the logo with the account alias and optional mining stats.
 * Column widths are measured from the text; resets textAlign/textBaseline on exit.
 */
export function drawStatBadge(
  canvasContext: CanvasRenderingContext2D,
  alias: string,
  miningStats: MiningStats | null,
  logoY: number,
  colors: CardColors,
): void {
  const { ORANGE, CARD_BACKGROUND, WHITE, MUTED, DIM } = colors;

  const columns: BadgeColumn[] = [];
  if (alias) columns.push({ label: "ACCOUNT", value: alias });
  if (miningStats) {
    columns.push({ label: "MINERS", value: `${miningStats.miners}` });
    columns.push({
      label: "HASHPOWER",
      value: formatTerahash(miningStats.totalTerahash),
      unit: "TH",
    });
    if (miningStats.averageEnergyEfficiency !== null)
      columns.push({
        label: "EFFICIENCY",
        value: `${Math.round(miningStats.averageEnergyEfficiency)}`,
        unit: "W/TH",
      });
  }

  const columnWidths = columns.map(({ label, value, unit }) => {
    canvasContext.font = canvasFont(LABEL_FONT_SIZE);
    const labelWidth = canvasContext.measureText(label).width;
    canvasContext.font = canvasFont(VALUE_FONT_SIZE, true);
    const valueWidth = canvasContext.measureText(value).width;
    const unitWidth = measureUnitWidth(canvasContext, unit);
    return Math.max(labelWidth, valueWidth + unitWidth) + COLUMN_PADDING * 2;
  });

  const badgeWidth = columnWidths.reduce((total, width) => total + width, 0);
  const badgeX = CARD_WIDTH - PADDING - badgeWidth;
  const badgeY = logoY + (LOGO_SIZE - BADGE_HEIGHT) / 2;
  const midY = badgeY + BADGE_HEIGHT / 2;
  const blockTop = midY - BLOCK_HEIGHT / 2;
  const labelY = blockTop;
  const valueY = blockTop + LABEL_FONT_SIZE + TEXT_GAP;

  fillRoundRect(
    canvasContext,
    badgeX,
    badgeY,
    badgeWidth,
    BADGE_HEIGHT,
    BADGE_CORNER,
    CARD_BACKGROUND,
  );
  fillRoundRect(
    canvasContext,
    badgeX,
    badgeY + BAR_INSET,
    BAR_WIDTH,
    BADGE_HEIGHT - BAR_INSET * 2,
    2,
    ORANGE,
  );

  let columnX = badgeX;
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
    const { label, value, unit } = columns[columnIndex];
    const columnWidth = columnWidths[columnIndex];
    const centerX = columnX + columnWidth / 2;

    canvasContext.font = canvasFont(LABEL_FONT_SIZE);
    canvasContext.fillStyle = MUTED;
    canvasContext.textAlign = "center";
    canvasContext.textBaseline = "top";
    canvasContext.fillText(label, centerX, labelY);

    canvasContext.font = canvasFont(VALUE_FONT_SIZE, true);
    const valueWidth = canvasContext.measureText(value).width;
    const unitWidth = measureUnitWidth(canvasContext, unit);
    const startX = centerX - (valueWidth + unitWidth) / 2;

    canvasContext.font = canvasFont(VALUE_FONT_SIZE, true);
    canvasContext.fillStyle = WHITE;
    canvasContext.textAlign = "left";
    canvasContext.textBaseline = "top";
    canvasContext.fillText(value, startX, valueY);
    if (unit) {
      canvasContext.font = canvasFont(UNIT_FONT_SIZE);
      canvasContext.fillStyle = MUTED;
      canvasContext.textBaseline = "top";
      canvasContext.fillText(
        unit,
        startX + valueWidth + 3,
        valueY + (VALUE_FONT_SIZE - UNIT_FONT_SIZE),
      );
    }

    if (columnIndex < columns.length - 1) {
      canvasContext.save();
      canvasContext.strokeStyle = DIM;
      canvasContext.lineWidth = 1;
      canvasContext.beginPath();
      canvasContext.moveTo(columnX + columnWidth, badgeY + 8);
      canvasContext.lineTo(columnX + columnWidth, badgeY + BADGE_HEIGHT - 8);
      canvasContext.stroke();
      canvasContext.restore();
    }

    columnX += columnWidth;
  }

  canvasContext.textAlign = "left";
  canvasContext.textBaseline = "top";
}
