export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'danger'
  | 'success'
  | 'warning'
  | 'outline'
  | 'link'
  | 'linkDanger';
export type ButtonSize = 'sm' | 'md' | 'block';

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
  success: 'btn-success',
  warning: 'btn-warning',
  outline: 'btn-outline',
  link: 'btn-link',
  linkDanger: 'btn-link-danger',
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: 'btn-sm rounded-xl',
  md: '',
  block: 'w-full rounded-xl',
};

export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return ['btn', variantClassName[variant], sizeClassName[size], className]
    .filter(Boolean)
    .join(' ');
}
