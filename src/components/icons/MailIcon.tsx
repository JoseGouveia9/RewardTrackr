import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function MailIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={14} strokeWidth={2} {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </SvgIcon>
  );
}
