const FONT_FAMILY = "'Space Grotesk', system-ui, sans-serif";
const AMOUNT_ICON_SIZE = 13;
const AMOUNT_ICON_GAP = 4;

export function canvasFont(size: number, bold = false): string {
  return `${bold ? "bold " : ""}${size}px ${FONT_FAMILY}`;
}

/** Fills a rounded rectangle; the radius is clamped to half of the smaller side. */
export function fillRoundRect(
  canvasContext: CanvasRenderingContext2D,
  positionX: number,
  positionY: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  canvasContext.fillStyle = color;
  canvasContext.beginPath();
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  canvasContext.moveTo(positionX + clampedRadius, positionY);
  canvasContext.lineTo(positionX + width - clampedRadius, positionY);
  canvasContext.quadraticCurveTo(
    positionX + width,
    positionY,
    positionX + width,
    positionY + clampedRadius,
  );
  canvasContext.lineTo(positionX + width, positionY + height - clampedRadius);
  canvasContext.quadraticCurveTo(
    positionX + width,
    positionY + height,
    positionX + width - clampedRadius,
    positionY + height,
  );
  canvasContext.lineTo(positionX + clampedRadius, positionY + height);
  canvasContext.quadraticCurveTo(
    positionX,
    positionY + height,
    positionX,
    positionY + height - clampedRadius,
  );
  canvasContext.lineTo(positionX, positionY + clampedRadius);
  canvasContext.quadraticCurveTo(positionX, positionY, positionX + clampedRadius, positionY);
  canvasContext.closePath();
  canvasContext.fill();
}

export function ellipsize(
  canvasContext: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (canvasContext.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && canvasContext.measureText(truncated + "\u2026").width > maxWidth)
    truncated = truncated.slice(0, -1);
  return truncated + "\u2026";
}

/**
 * Draws the amount ellipsized to fit, with the currency icon trailing it.
 * The caller must set font, fillStyle and textAlign beforehand.
 */
export function drawAmountWithIcon(
  canvasContext: CanvasRenderingContext2D,
  text: string,
  icon: HTMLImageElement | undefined,
  positionX: number,
  positionY: number,
  fontSize: number,
  textMaxWidth: number,
): void {
  const amountText = ellipsize(
    canvasContext,
    text,
    textMaxWidth - AMOUNT_ICON_SIZE - AMOUNT_ICON_GAP,
  );
  canvasContext.fillText(amountText, positionX, positionY);
  if (!icon) return;
  const amountWidth = canvasContext.measureText(amountText).width;
  canvasContext.drawImage(
    icon,
    positionX + amountWidth + AMOUNT_ICON_GAP,
    positionY + fontSize / 2 - AMOUNT_ICON_SIZE / 2 - 1,
    AMOUNT_ICON_SIZE,
    AMOUNT_ICON_SIZE,
  );
}
