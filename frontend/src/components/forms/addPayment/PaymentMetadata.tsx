import React from 'react';
import type { Payment } from '../../../types';

interface PaymentMetadataProps {
  payment: Payment;
}

export const PaymentMetadata: React.FC<PaymentMetadataProps> = ({ payment }) => (
  <div className="app-panel-muted p-4">
    <p className="app-label mb-2">Технические данные</p>
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-500">ID</span>
        <span className="font-mono text-slate-700">{payment.id}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-500">Создан</span>
        <span className="font-mono text-slate-700">{payment.createdAt}</span>
      </div>
    {payment.updatedAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-500">Обновлён</span>
          <span className="font-mono text-slate-700">{payment.updatedAt}</span>
        </div>
    )}
    {payment.deletedAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-500">Удалён</span>
          <span className="font-mono text-slate-700">{payment.deletedAt}</span>
        </div>
    )}
    </div>
  </div>
);
