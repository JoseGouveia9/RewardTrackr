export function formatBtc(btc: number): string {
  const truncated = Math.trunc(btc * 1e8) / 1e8;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

export function formatGmt(gmt: number): string {
  const truncated = Math.trunc(gmt * 100) / 100;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatFiat(value: number): string {
  const truncated = Math.trunc(value * 100) / 100;
  return truncated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(percent: number): string {
  return (percent > 0 ? "+" : "") + percent.toFixed(1) + "%";
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value);
}

export function formatTerahash(terahash: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(terahash) + " TH";
}

export function formatMultiplier(
  minerWarsMultiplier: number | null,
  solo: number | null,
): string | null {
  if (minerWarsMultiplier == null || solo == null || solo === 0) return null;
  return `${(minerWarsMultiplier / solo).toFixed(2)}x`;
}
