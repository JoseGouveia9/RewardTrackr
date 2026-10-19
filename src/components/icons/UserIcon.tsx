import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function UserIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={16} strokeWidth={2} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </SvgIcon>
  );
}
