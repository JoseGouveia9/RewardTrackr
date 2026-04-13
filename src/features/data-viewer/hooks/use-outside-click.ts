import { useEffect, useRef, type RefObject } from "react";

// Calls onClose when a mousedown occurs outside of ref. Only listens when open is true.
export function useOutsideClick(
  ref: RefObject<Element | null>,
  onClose: () => void,
  open: boolean,
) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, ref]);
}
