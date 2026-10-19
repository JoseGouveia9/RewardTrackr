import { useEffect, useState } from "react";
import { fetchLatestRate } from "@/lib/fx-rates";

export function useExtraFiatRate(code: string | null): number | null {
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (!code) {
      setRate(null);
      return;
    }
    let cancelled = false;
    void fetchLatestRate(code)
      .then((value) => {
        if (!cancelled) setRate(value);
      })
      .catch(() => {
        if (!cancelled) setRate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return rate;
}
