import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

import { AppIcon, type AppIconName } from './AppIcon';
import { buttonClassName, type ButtonSize, type ButtonVariant } from './buttonClassName';

export type { ButtonSize, ButtonVariant } from './buttonClassName';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: AppIconName;
  iconPosition?: 'start' | 'end';
  isLoading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
};

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: AppIconName;
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
};

export type ActionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export type DisclosureSummaryProps = HTMLAttributes<HTMLElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const iconToneClassName: Record<NonNullable<IconButtonProps['tone']>, string> = {
  neutral: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  primary: 'border-sky-200 text-sky-700 hover:bg-sky-50',
  success: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  warning: 'border-amber-200 text-amber-700 hover:bg-amber-50',
  danger: 'border-rose-200 text-rose-700 hover:bg-rose-50',
};

const iconSizeClassName: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'start',
  isLoading = false,
  loadingLabel = 'Загрузка…',
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const resolvedClassName = buttonClassName({ variant, size, className });
  const iconNode = icon ? <AppIcon name={icon} size={size === 'sm' ? 14 : 16} /> : null;

  return (
    <button
      type={type}
      className={resolvedClassName}
      {...props}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {iconPosition === 'start' && iconNode}
          {children}
          {iconPosition === 'end' && iconNode}
        </>
      )}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  tone = 'neutral',
  size = 'md',
  className = '',
  type = 'button',
  title,
  ...props
}: IconButtonProps) {
  const resolvedClassName = [
    'icon-btn',
    iconToneClassName[tone],
    iconSizeClassName[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={resolvedClassName}
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      <AppIcon name={icon} size={size === 'sm' ? 14 : 16} />
    </button>
  );
}

export function ActionLink({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ActionLinkProps) {
  return (
    <a className={buttonClassName({ variant, size, className })} {...props}>
      {children}
    </a>
  );
}

export function DisclosureSummary({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: DisclosureSummaryProps) {
  return (
    <summary className={buttonClassName({ variant, size, className })} {...props}>
      {children}
    </summary>
  );
}
