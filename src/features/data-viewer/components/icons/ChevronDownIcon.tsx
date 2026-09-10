export function ChevronDownIcon({
  className,
  width = 10,
  height = 6,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 10 6"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 0l5 6 5-6z" />
    </svg>
  );
}
