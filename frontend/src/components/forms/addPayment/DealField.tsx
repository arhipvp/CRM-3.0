import React from 'react';

interface DealFieldProps {
  dealDisplayValue: string;
  dealId: string;
  dealIsFixed: boolean;
  loading: boolean;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DealField: React.FC<DealFieldProps> = ({
  dealDisplayValue,
  dealIsFixed,
  loading,
  value,
  onChange,
}) =>
  dealIsFixed ? (
    <div className="space-y-2">
      <label htmlFor="dealId" className="app-label">
        Сделка
      </label>
      <input
        type="text"
        id="dealId"
        name="dealId"
        value={dealDisplayValue}
        disabled
        className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  ) : (
    <div className="space-y-2">
      <label htmlFor="dealId" className="app-label">
        Сделка (по возможности)
      </label>
      <input
        type="text"
        id="dealId"
        name="dealId"
        value={value}
        onChange={onChange}
        placeholder="ID сделки"
        disabled={loading}
        className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  );
