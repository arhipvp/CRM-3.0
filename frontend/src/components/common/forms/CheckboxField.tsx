import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

export function CheckboxField({
  label,
  description,
  error,
  className = '',
  id,
  ...props
}: CheckboxFieldProps) {
  return (
    <div className={['space-y-1', className].filter(Boolean).join(' ')}>
      <label className="flex items-start gap-2 text-sm text-[var(--app-text)]" htmlFor={id}>
        <input id={id} type="checkbox" className="check mt-0.5 shrink-0" {...props} />
        <span>
          <span className="font-medium">{label}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{description}</span>
          )}
        </span>
      </label>
      {error && (
        <p className="pl-6 text-xs text-[var(--app-danger-text)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
