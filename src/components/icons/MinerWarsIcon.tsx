export function MinerWarsIcon({
  className,
  width = 18,
  height = 14,
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
      viewBox="0 12 125 98"
      fill="none"
      aria-hidden="true"
    >
      <g
        transform="translate(71, 70) rotate(45) translate(-50,-55)"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <rect x="46" y="15" width="8" height="90" rx="2" />
        <path d="M 12 22 C 30 -5, 70 -5, 88 22 C 75 18, 65 14, 55 14 L 55 22 L 45 22 L 45 14 C 35 14, 25 18, 12 22 Z" />
      </g>
      <g
        transform="translate(54, 70) rotate(-45) translate(-50,-55)"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <rect x="46" y="15" width="8" height="90" rx="2" />
        <path d="M 12 22 C 30 -5, 70 -5, 88 22 C 75 18, 65 14, 55 14 L 55 22 L 45 22 L 45 14 C 35 14, 25 18, 12 22 Z" />
      </g>
    </svg>
  );
}
