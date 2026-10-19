import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls onClose on a mousedown outside ref while open; the latest onClose is used without
 * re-subscribing.
 */
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
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onCloseRef.current();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, ref]);
}
