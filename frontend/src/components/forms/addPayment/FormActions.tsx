import React from 'react';

interface FormActionsProps {
  loading: boolean;
  paymentExists: boolean;
  onCancel: () => void;
}

export const FormActions: React.FC<FormActionsProps> = ({ loading, paymentExists, onCancel }) => (
  <div className="form-actions">
    <button type="submit" disabled={loading} className="btn-primary">
      {loading ? 'Сохраняем...' : paymentExists ? 'Обновить' : 'Сохранить'}
    </button>
    <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
      Отмена
    </button>
  </div>
);
