import { BtcIcon, FiatIcon, GmtIcon, UsdIcon } from "@/components/icons/currency-icons";
import { formatBtc, formatFiat, formatGmt } from "../../utils/format";

interface CurrencyAmountProps {
  btc: number;
  gmt: number | null;
  usd: number | null;
  prefix?: string;
  showGmt: boolean;
  showUsd: boolean;
  showFiat: boolean;
  extraFiatRate: number | null;
  extraFiatCode: string | null;
}

export function CurrencyAmount({
  btc,
  gmt,
  usd,
  prefix = "",
  showGmt,
  showUsd,
  showFiat,
  extraFiatRate,
  extraFiatCode,
}: CurrencyAmountProps) {
  if (showGmt && gmt != null) {
    return (
      <>
        <GmtIcon /> {prefix + formatGmt(gmt)}
      </>
    );
  }
  if (showUsd && usd != null) {
    return (
      <>
        <UsdIcon /> {prefix + formatFiat(usd)}
      </>
    );
  }
  if (showFiat && usd != null && extraFiatRate != null && extraFiatCode) {
    return (
      <>
        <FiatIcon code={extraFiatCode} /> {prefix + formatFiat(usd * extraFiatRate)}
      </>
    );
  }
  return (
    <>
      <BtcIcon /> {prefix + formatBtc(btc)}
    </>
  );
}
