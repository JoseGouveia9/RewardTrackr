import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function SwordIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={16} strokeWidth={2} {...props}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M9 5 5 9" />
    </SvgIcon>
  );
}
