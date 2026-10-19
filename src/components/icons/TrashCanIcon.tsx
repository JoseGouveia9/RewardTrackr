import { SvgIcon, type SvgIconProps } from "./svg-icon";

interface TrashCanIconProps extends SvgIconProps {
  bars?: boolean;
}

export function TrashCanIcon({ bars = false, ...props }: TrashCanIconProps) {
  return (
    <SvgIcon strokeWidth={2.2} {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      {bars && (
        <>
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </>
      )}
    </SvgIcon>
  );
}
