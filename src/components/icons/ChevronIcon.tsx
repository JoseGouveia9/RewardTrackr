import { SvgIcon, type SvgIconProps } from "./svg-icon";

interface ChevronIconProps extends SvgIconProps {
  direction?: "up" | "down";
}

export function ChevronIcon({ direction = "down", ...props }: ChevronIconProps) {
  return (
    <SvgIcon size={12} strokeWidth={2.5} {...props}>
      <polyline points={direction === "up" ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
    </SvgIcon>
  );
}
