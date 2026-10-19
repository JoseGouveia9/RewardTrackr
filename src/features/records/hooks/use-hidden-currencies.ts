import { useCallback, useState } from "react";

export function useHiddenCurrencies() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = useCallback(
    (currency: string) =>
      setHidden((previouslyHidden) => {
        const next = new Set(previouslyHidden);
        if (next.has(currency)) next.delete(currency);
        else next.add(currency);
        return next;
      }),
    [],
  );
  return [hidden, toggle] as const;
}
