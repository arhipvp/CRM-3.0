import React from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  hint,
  className,
  children,
}) => {
  const wrapperClassName = ['space-y-2', className].filter(Boolean).join(' ');

  return (
    <div className={wrapperClassName}>
      <label htmlFor={htmlFor} className="app-label">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
    </div>
  );
};
