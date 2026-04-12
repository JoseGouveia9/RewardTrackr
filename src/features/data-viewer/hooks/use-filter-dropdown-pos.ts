import { useFloating, autoUpdate, offset, shift } from "@floating-ui/react";

// Anchors a filter dropdown directly below its trigger button.
// Floating UI positions via GPU-composited transforms (no top/left layout
// recalcs) and autoUpdate keeps it in sync with any scroll or resize.
//
// Returns:
//   btnRef      – callback ref for the trigger button  (ref={btnRef})
//   dropRef     – callback ref for the dropdown div    (ref={dropRef})
//   floatingRef – RefObject for the dropdown node      (floatingRef.current for outside-click checks)
//   style       – floatingStyles to spread onto the dropdown div
export function useFilterDropdownPos(open: boolean) {
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [
      offset(8),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: open ? autoUpdate : undefined,
  });

  // capturePos kept for API compatibility with callers.
  function capturePos() {}

  return {
    btnRef: refs.setReference,
    dropRef: refs.setFloating,
    floatingRef: refs.floating,
    style: floatingStyles,
    capturePos,
  };
}
