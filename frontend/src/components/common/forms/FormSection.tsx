import React from 'react';

interface FormSectionProps {
  className?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ className, children }) => {
  const resolvedClassName = ['space-y-4', className].filter(Boolean).join(' ');
  return <div className={resolvedClassName}>{children}</div>;
};
