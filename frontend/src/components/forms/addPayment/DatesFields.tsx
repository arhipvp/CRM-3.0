import React from 'react';

interface DatesFieldsProps {
  scheduledDate: string | null | undefined;
  actualDate: string | null | undefined;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
}

export const DatesFields: React.FC<DatesFieldsProps> = ({
  scheduledDate,
  actualDate,
  onChange,
  loading,
}) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <div className="space-y-2">
      <label htmlFor="scheduledDate" className="app-label">
        Плановая дата
      </label>
      <input
        type="date"
        id="scheduledDate"
        name="scheduledDate"
        value={scheduledDate || ''}
        onChange={onChange}
        disabled={loading}
        className="field field-input"
      />
    </div>
    <div className="space-y-2">
      <label htmlFor="actualDate" className="app-label">
        Фактическая дата
      </label>
      <input
        type="date"
        id="actualDate"
        name="actualDate"
        value={actualDate || ''}
        onChange={onChange}
        disabled={loading}
        className="field field-input"
      />
    </div>
  </div>
);
