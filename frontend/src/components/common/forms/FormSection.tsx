import React from 'react';

export interface FormSectionProps {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  className,
  children,
}) => {
  const resolvedClassName = ['space-y-3', className].filter(Boolean).join(' ');
  return (
    <section className={resolvedClassName}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
};
