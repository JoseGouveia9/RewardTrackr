export function NewBadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" width="46" height="46" aria-hidden="true">
      <defs>
        <linearGradient id="ann-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe566" />
          <stop offset="50%" stopColor="#f7b733" />
          <stop offset="100%" stopColor="#c97d10" />
        </linearGradient>
      </defs>
      <polygon
        points="50,4 60.1,12.3 73,10.2 77.6,22.4 89.8,27 87.7,39.9 96,50 87.7,60.1 89.8,73 77.6,77.6 73,89.8 60.1,87.7 50,96 39.9,87.7 27,89.8 22.4,77.6 10.2,73 12.3,60.1 4,50 12.3,39.9 10.2,27 22.4,22.4 27,10.2 39.9,12.3"
        fill="url(#ann-gold-grad)"
      />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="23"
        fontWeight="800"
        letterSpacing="1"
      >
        NEW
      </text>
    </svg>
  );
}
