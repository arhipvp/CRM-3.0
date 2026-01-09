import React from 'react';

interface LabelValuePairProps {
  label: string;
  value?: React.ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}

export const LabelValuePair: React.FC<LabelValuePairProps> = ({
  label,
  value,
  className = '',
  labelClassName = '',
  valueClassName = '',
}) => (
  <p className={`flex flex-wrap items-baseline gap-2 text-sm text-slate-600 ${className}`}>
    <span className={`text-[10px] uppercase tracking-[0.4em] text-slate-400 ${labelClassName}`}>
      {label}:
    </span>
    <span className={`font-semibold text-slate-900 ${valueClassName}`}>{value ?? '—'}</span>
  </p>
);
