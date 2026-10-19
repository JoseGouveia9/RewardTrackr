import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function ArrowDownToLineIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={18} viewBox="0 0 18 18" {...props}>
      <path d="M9 2v10M9 12l-3.5-3.5M9 12l3.5-3.5" />
      <path d="M2 15h14" />
    </SvgIcon>
  );
}
