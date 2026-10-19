import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function CrossCircleIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={15} strokeWidth={2.5} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </SvgIcon>
  );
}
