import type { ReactNode } from "react";

export interface SvgIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

interface SvgIconBaseProps extends SvgIconProps {
  viewBox?: string;
  fill?: string;
  stroke?: string;
  children: ReactNode;
}

export function SvgIcon({
  size = 14,
  strokeWidth = 2,
  className,
  viewBox = "0 0 24 24",
  fill = "none",
  stroke = "currentColor",
  children,
}: SvgIconBaseProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
