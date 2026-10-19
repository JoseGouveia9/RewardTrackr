import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function CheckIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={14} strokeWidth={2.5} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </SvgIcon>
  );
}
