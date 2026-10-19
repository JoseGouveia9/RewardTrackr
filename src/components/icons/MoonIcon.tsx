import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function MoonIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={14} strokeWidth={2} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </SvgIcon>
  );
}
