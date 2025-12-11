import React from 'react';

import { ColoredLabel } from '../../common/ColoredLabel';
import type { Deal } from '../../../types';

const getWhatsAppLink = (phone?: string) => {
  if (!phone) {
    return null;
  }

  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly ? `https://wa.me/${digitsOnly}` : null;
};

interface DealHeaderProps {
  deal: Deal;
  clientDisplayName: string;
  clientPhone?: string;
  sellerDisplayName: string;
  executorDisplayName: string;
}

export const DealHeader: React.FC<DealHeaderProps> = ({
  deal,
  clientDisplayName,
  clientPhone,
  sellerDisplayName,
  executorDisplayName,
}) => {
  const whatsAppLink = getWhatsAppLink(clientPhone);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-[10px] tracking-[0.4em] text-slate-400 uppercase">
            Выбранная сделка:
          </p>
          <p className="text-base font-semibold text-slate-900">{deal.title}</p>
        </div>
        {deal.description && (
          <p className="text-sm leading-relaxed text-slate-500 max-w-3xl">
            {deal.description}
          </p>
        )}
        <p className="text-sm text-slate-500">
          Клиент:
          <span className="ml-2 inline-flex items-center gap-2 text-base font-semibold text-slate-900">
            {clientDisplayName}
            {whatsAppLink && (
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Написать клиенту в WhatsApp"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                >
                  <path d="M7.2 8.6a1 1 0 0 1 1.05.28l1.13 1.14c.33.33.34.87.01 1.21l-.2.2a9.7 9.7 0 0 0 3.73 3.73l.2-.2c.15-.16.37-.24.58-.24.22 0 .44.08.6.24l1.14 1.13c.29.29.33.75.08 1.07l-1.12 1.68a1 1 0 0 1-1.18.41c-1.55-.62-3.48-1.52-5.25-3.3-1.77-1.77-2.68-3.7-3.3-5.25a1 1 0 0 1 .41-1.18l1.68-1.12c.31-.21.72-.2 1.01.08z" />
                </svg>
              </a>
            )}
          </span>
        </p>
        <p className="text-xs text-slate-400">
          Ответственный:{' '}
          <ColoredLabel
            value={sellerDisplayName !== '—' ? sellerDisplayName : undefined}
            fallback="—"
            showDot={false}
            className="text-slate-900 font-semibold"
          />{' '}
          · Исполнитель:{' '}
          <ColoredLabel
            value={executorDisplayName !== '—' ? executorDisplayName : undefined}
            fallback="—"
            showDot={false}
            className="text-slate-900 font-semibold"
          />
        </p>
        {deal.closingReason && (
          <p className="text-xs text-slate-500">Причина закрытия: {deal.closingReason}</p>
        )}
      </div>
    </div>
  );
};
