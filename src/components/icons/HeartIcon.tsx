import { SvgIcon, type SvgIconProps } from "./svg-icon";

const FILLED_COLOR = "#e0192a";

interface HeartIconProps extends SvgIconProps {
  filled?: boolean;
}

export function HeartIcon({ filled = false, ...props }: HeartIconProps) {
  return (
    <SvgIcon
      size={18}
      {...props}
      strokeWidth={filled ? 1.5 : (props.strokeWidth ?? 2)}
      fill={filled ? FILLED_COLOR : undefined}
      stroke={filled ? FILLED_COLOR : undefined}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </SvgIcon>
  );
}
