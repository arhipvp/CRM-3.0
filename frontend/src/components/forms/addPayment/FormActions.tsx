import React from 'react';

interface FormActionsProps {
  loading: boolean;
  paymentExists: boolean;
  onCancel: () => void;
}

export const FormActions: React.FC<FormActionsProps> = ({ loading, paymentExists, onCancel }) => (
  <div className="flex items-center justify-end gap-3 pt-2">
    <button type="submit" disabled={loading} className="btn btn-primary">
      {loading ? 'Сохраняем...' : paymentExists ? 'Обновить' : 'Сохранить'}
    </button>
    <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary">
      Отмена
    </button>
  </div>
);
