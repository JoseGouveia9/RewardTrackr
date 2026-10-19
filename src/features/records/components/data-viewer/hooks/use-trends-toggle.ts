import { useRef, useState } from "react";

/**
 * Toggles the trends panel, keeping it mounted during the 220ms enter and 180ms exit animations.
 */
export function useTrendsToggle() {
  const [showTrends, setShowTrends] = useState(false);
  const [trendsAnimating, setTrendsAnimating] = useState(false);
  const [trendsExiting, setTrendsExiting] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleTrends = () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (animationTimer.current) clearTimeout(animationTimer.current);
    if (!showTrends) {
      setTrendsExiting(false);
      setTrendsAnimating(true);
      setShowTrends(true);
      animationTimer.current = setTimeout(() => setTrendsAnimating(false), 220);
    } else {
      setTrendsAnimating(false);
      setTrendsExiting(true);
      exitTimer.current = setTimeout(() => {
        setShowTrends(false);
        setTrendsExiting(false);
      }, 180);
    }
  };

  return { showTrends, trendsAnimating, trendsExiting, toggleTrends };
}
