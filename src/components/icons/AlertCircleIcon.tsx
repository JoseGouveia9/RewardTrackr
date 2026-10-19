import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function AlertCircleIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={14} strokeWidth={2.2} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12" y2="16" />
    </SvgIcon>
  );
}
