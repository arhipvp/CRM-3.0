import React from 'react';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  className,
  children,
}) => {
  const wrapperClassName = ['space-y-1.5', className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClassName}>
      <label htmlFor={htmlFor} className="app-label">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-rose-700" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
};
