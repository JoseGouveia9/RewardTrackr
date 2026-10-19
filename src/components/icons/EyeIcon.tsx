import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function EyeIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={14} strokeWidth={2.5} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  );
}
