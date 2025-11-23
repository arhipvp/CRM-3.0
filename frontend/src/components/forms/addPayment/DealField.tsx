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
    <div className="form-group">
      <label htmlFor="dealId">Сделка</label>
      <input type="text" id="dealId" name="dealId" value={dealDisplayValue} disabled />
    </div>
  ) : (
    <div className="form-group">
      <label htmlFor="dealId">Сделка (по возможности)</label>
      <input
        type="text"
        id="dealId"
        name="dealId"
        value={value}
        onChange={onChange}
        placeholder="ID сделки"
        disabled={loading}
      />
    </div>
  );
