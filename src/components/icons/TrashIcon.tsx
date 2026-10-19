import { SvgIcon, type SvgIconProps } from "./svg-icon";

export function TrashIcon(props: SvgIconProps) {
  return (
    <SvgIcon size={13} strokeWidth={2} {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </SvgIcon>
  );
}
