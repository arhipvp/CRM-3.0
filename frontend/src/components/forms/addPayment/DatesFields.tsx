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
  <div className="form-row">
    <div className="form-group">
      <label htmlFor="scheduledDate">Плановая дата</label>
      <input
        type="date"
        id="scheduledDate"
        name="scheduledDate"
        value={scheduledDate || ''}
        onChange={onChange}
        disabled={loading}
      />
    </div>
    <div className="form-group">
      <label htmlFor="actualDate">Фактическая дата</label>
      <input
        type="date"
        id="actualDate"
        name="actualDate"
        value={actualDate || ''}
        onChange={onChange}
        disabled={loading}
      />
    </div>
  </div>
);
