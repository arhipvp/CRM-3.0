import React from 'react';

import { Button } from '../Button';

interface FormActionsProps {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  isSubmitDisabled?: boolean;
  align?: 'end' | 'between';
  submitClassName?: string;
  cancelClassName?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  cancelLabel = 'Отмена',
  submitLabel,
  submittingLabel = 'Сохраняем...',
  isSubmitting = false,
  isSubmitDisabled = false,
  align = 'end',
  submitClassName,
  cancelClassName,
}) => {
  const containerClassName =
    align === 'between'
      ? 'flex items-center justify-between gap-3 pt-2'
      : 'flex items-center justify-end gap-3 pt-2';

  return (
    <div className={containerClassName}>
      {onCancel && (
        <Button
          onClick={onCancel}
          disabled={isSubmitting}
          variant="secondary"
          className={cancelClassName || 'btn btn-secondary'}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        type="submit"
        disabled={isSubmitting || isSubmitDisabled}
        variant="primary"
        className={submitClassName || 'btn btn-primary'}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
};
