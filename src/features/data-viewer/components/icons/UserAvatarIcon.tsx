export function UserAvatarIcon({
  size = 18,
  color = "#f7931a",
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
      <path
        d="M4 20c0-3.31 3.58-6 8-6s8 2.69 8 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
