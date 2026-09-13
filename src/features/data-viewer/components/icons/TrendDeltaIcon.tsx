export function TrendDeltaIcon({
  up,
  className,
  width = 8,
  height = 8,
}: {
  up: boolean;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      {up ? <polygon points="5,1 9,9 1,9" /> : <polygon points="1,1 9,1 5,9" />}
    </svg>
  );
}
