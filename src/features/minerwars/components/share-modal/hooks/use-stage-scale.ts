import { useEffect, useRef, useState } from "react";

/**
 * Scales the fixed-width share card down to fit its preview container, following resizes while
 * open.
 */
export function useStageScale(open: boolean, cardWidth: number) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    if (!open) return;
    const stageElement = stageRef.current;
    if (!stageElement) return;
    const update = () => {
      const stageWidth = stageElement.clientWidth;
      if (stageWidth > 0) setScale(Math.min(1, stageWidth / cardWidth));
    };
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(stageElement);
    return () => resizeObserver.disconnect();
  }, [open, cardWidth]);

  return { stageRef, scale };
}
