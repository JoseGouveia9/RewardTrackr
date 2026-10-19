export function RecordsIcon({
  className,
  width = 18,
  height = 18,
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
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
      <circle cx="6" cy="9" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="13" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
