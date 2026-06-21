import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { AppIcon, type AppIconName } from './AppIcon';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'success' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'block';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: AppIconName;
  iconPosition?: 'start' | 'end';
  children: ReactNode;
};

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: AppIconName;
  label: string;
  tone?: 'neutral' | 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md';
};

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
  success: 'btn-success',
  outline: 'btn-outline',
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: 'btn-sm rounded-xl',
  md: '',
  block: 'w-full rounded-xl',
};

const iconToneClassName: Record<NonNullable<IconButtonProps['tone']>, string> = {
  neutral: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  primary: 'border-sky-200 text-sky-700 hover:bg-sky-50',
  danger: 'border-rose-200 text-rose-700 hover:bg-rose-50',
  success: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
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
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const resolvedClassName = ['btn', variantClassName[variant], sizeClassName[size], className]
    .filter(Boolean)
    .join(' ');
  const iconNode = icon ? <AppIcon name={icon} size={size === 'sm' ? 15 : 17} /> : null;

  return (
    <button type={type} className={resolvedClassName} {...props}>
      {iconPosition === 'start' && iconNode}
      {children}
      {iconPosition === 'end' && iconNode}
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
      <AppIcon name={icon} size={size === 'sm' ? 15 : 17} />
    </button>
  );
}
