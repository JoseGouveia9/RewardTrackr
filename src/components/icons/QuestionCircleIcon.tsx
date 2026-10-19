import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function QuestionCircleIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={18} strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </SvgIcon>
  );
}
