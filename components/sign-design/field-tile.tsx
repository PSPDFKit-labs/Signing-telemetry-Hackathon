import Link from 'next/link';
import type { ReactNode } from 'react';

type CommonProps = {
  icon?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
  /** Render the icon with accent-tint background + accent color (default false uses surface/ink-2). */
  accentIcon?: boolean;
};

type ButtonProps = CommonProps & {
  href?: undefined;
  onClick?: () => void;
};

type LinkProps = CommonProps & {
  href: string;
  onClick?: undefined;
};

export function FieldTile(props: ButtonProps | LinkProps) {
  const { icon, children, style, accentIcon } = props;

  const iconStyle: React.CSSProperties | undefined = accentIcon
    ? { background: 'var(--brand-accent-tint)', color: 'var(--brand-accent)' }
    : undefined;

  const labelStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  };

  const inner = (
    <>
      {icon && (
        <span className="field-ico" style={iconStyle}>
          {icon}
        </span>
      )}
      <span style={labelStyle}>{children}</span>
    </>
  );

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className="field-tile" style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className="field-tile" onClick={props.onClick} style={style}>
      {inner}
    </button>
  );
}
