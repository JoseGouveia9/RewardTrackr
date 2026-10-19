import { useCallback, useState, type RefObject } from "react";

/**
 * Renders the share card node to a 2x PNG and downloads it; retries without images when
 * cross-origin avatars/logos taint the canvas.
 */
export function useShareImageDownload({
  cardRef,
  light,
  cycleId,
}: {
  cardRef: RefObject<HTMLDivElement | null>;
  light: boolean;
  cycleId: number | null | undefined;
}) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = useCallback(async () => {
    const node = cardRef.current;
    if (!node || generating) return;
    setGenerating(true);
    try {
      const { toPng } = await import("html-to-image");
      const options = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: light ? "#ffffff" : "#0f0f0f",
      };
      let dataUrl: string;
      try {
        dataUrl = await toPng(node, options);
      } catch {
        dataUrl = await toPng(node, {
          ...options,
          filter: (element) => !(element instanceof HTMLImageElement),
        });
      }
      const downloadLink = document.createElement("a");
      downloadLink.download = `minerwars-cycle-${cycleId ?? "latest"}.png`;
      downloadLink.href = dataUrl;
      downloadLink.click();
    } finally {
      setGenerating(false);
    }
  }, [cardRef, generating, light, cycleId]);

  return { generating, handleDownload };
}
