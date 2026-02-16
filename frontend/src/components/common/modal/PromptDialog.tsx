import React from 'react';

import { BTN_PRIMARY, BTN_SECONDARY } from '../buttonStyles';
import { FormActions } from '../forms/FormActions';
import { FormError } from '../forms/FormError';
import { FormField } from '../forms/FormField';
import { FormModal } from './FormModal';

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  isSubmitting?: boolean;
  placeholder?: string;
  error?: string | null;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  isOpen,
  title,
  label,
  value,
  onChange,
  onCancel,
  onConfirm,
  confirmLabel,
  isSubmitting = false,
  placeholder,
  error,
}) => {
  return (
    <FormModal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      size="sm"
      closeOnOverlayClick={false}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        className="space-y-4"
      >
        <FormError message={error} />
        <FormField label={label} required>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            className="field-textarea"
            placeholder={placeholder}
            disabled={isSubmitting}
          />
        </FormField>
        <FormActions
          onCancel={onCancel}
          submitLabel={confirmLabel}
          isSubmitting={isSubmitting}
          submitClassName={`${BTN_PRIMARY} rounded-xl`}
          cancelClassName={`${BTN_SECONDARY} rounded-xl`}
        />
      </form>
    </FormModal>
  );
};
