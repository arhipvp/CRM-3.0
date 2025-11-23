import React from 'react';
import type { Payment } from '../../../types';

interface PaymentMetadataProps {
  payment: Payment;
}

export const PaymentMetadata: React.FC<PaymentMetadataProps> = ({ payment }) => (
  <div className="technical-fields">
    <div className="tech-field">
      <span className="tech-label">ID:</span>
      <span className="tech-value">{payment.id}</span>
    </div>
    <div className="tech-field">
      <span className="tech-label">Создан:</span>
      <span className="tech-value">{payment.createdAt}</span>
    </div>
    {payment.updatedAt && (
      <div className="tech-field">
        <span className="tech-label">Обновлён:</span>
        <span className="tech-value">{payment.updatedAt}</span>
      </div>
    )}
    {payment.deletedAt && (
      <div className="tech-field">
        <span className="tech-label">Удалён:</span>
        <span className="tech-value">{payment.deletedAt}</span>
      </div>
    )}
  </div>
);
