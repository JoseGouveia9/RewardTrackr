import { createContext, useContext, useEffect } from "react";

export interface RowSelectionControls {
  selectAll: () => void;
  selectNone: () => void;
}

type SetRowSelectionControls = (controls: RowSelectionControls | null) => void;

const RowSelectionControlsContext = createContext<SetRowSelectionControls | null>(null);

export const RowSelectionControlsProvider = RowSelectionControlsContext.Provider;

/** Lets the active table publish its select-all/select-none handlers for the header toolbar. */
export function useRegisterRowSelectionControls(
  enabled: boolean,
  selectAll: () => void,
  selectNone: () => void,
) {
  const setControls = useContext(RowSelectionControlsContext);
  useEffect(() => {
    setControls?.(enabled ? { selectAll, selectNone } : null);
    return () => setControls?.(null);
  }, [setControls, enabled, selectAll, selectNone]);
}
