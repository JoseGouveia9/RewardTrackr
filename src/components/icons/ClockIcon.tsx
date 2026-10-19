import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function ClockIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={15} strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </SvgIcon>
  );
}
