import { ColoredLabel } from '../../common/ColoredLabel';
import type { Client, Deal } from '../../../types';
import { buildTelegramLink, buildWhatsAppLink } from '../../../utils/links';

interface DealHeaderProps {
  deal: Deal;
  clientDisplayName: string;
  client?: Client | null;
  clientPhone?: string;
  sellerDisplayName: string;
  executorDisplayName: string;
  myTrackedTimeLabel?: string;
  onClientEdit?: (client: Client) => void;
}

export const DealHeader: React.FC<DealHeaderProps> = ({
  deal,
  clientDisplayName,
  client,
  clientPhone,
  sellerDisplayName,
  executorDisplayName,
  myTrackedTimeLabel,
  onClientEdit,
}) => {
  const whatsAppLink = buildWhatsAppLink(clientPhone);
  const telegramLink = buildTelegramLink(clientPhone);
  const clientNote = client?.notes?.trim();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Сделка
          </p>
          <h2 className="text-xl font-semibold leading-tight text-slate-900">{deal.title}</h2>
        </div>

        {deal.description && (
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{deal.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Клиент
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
            {clientDisplayName}
            {clientNote && (
              <span className="text-xs font-semibold text-rose-600">- {clientNote}</span>
            )}
            {client && onClientEdit && (
              <button
                type="button"
                onClick={() => onClientEdit(client)}
                className="icon-btn h-7 w-7"
                aria-label={`Редактировать клиента ${client.name}`}
                title="Редактировать"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M15.2 4.5a1 1 0 0 1 1.4 0l2.9 2.9a1 1 0 0 1 0 1.4l-9.8 9.8-3.8.9a1 1 0 0 1-1.2-1.2l.9-3.8 9.6-10zM5.7 19.3l1.9-.5-.7-.7-.7-.7-.5 1.9z" />
                </svg>
              </button>
            )}
            {whatsAppLink && (
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Написать клиенту в WhatsApp"
                className="icon-btn h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M7.2 8.6a1 1 0 0 1 1.05.28l1.13 1.14c.33.33.34.87.01 1.21l-.2.2a9.7 9.7 0 0 0 3.73 3.73l.2-.2c.15-.16.37-.24.58-.24.22 0 .44.08.6.24l1.14 1.13c.29.29.33.75.08 1.07l-1.12 1.68a1 1 0 0 1-1.18.41c-1.55-.62-3.48-1.52-5.25-3.3-1.77-1.77-2.68-3.7-3.3-5.25a1 1 0 0 1 .41-1.18l1.68-1.12c.31-.21.72-.2 1.01.08z" />
                </svg>
              </a>
            )}
            {telegramLink && (
              <a
                href={telegramLink}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Написать клиенту в Telegram"
                className="icon-btn h-7 w-7 border-sky-200 text-sky-700 hover:bg-sky-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M3 12l17-9-5 17-4-6-4 6z" />
                </svg>
              </a>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ответственный
          </span>
          <ColoredLabel
            value={sellerDisplayName !== '—' ? sellerDisplayName : undefined}
            fallback="—"
            showDot={false}
            className="font-semibold text-slate-900"
          />
          <span className="text-slate-400">•</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Исполнитель
          </span>
          <ColoredLabel
            value={executorDisplayName !== '—' ? executorDisplayName : undefined}
            fallback="—"
            showDot={false}
            className="font-semibold text-slate-900"
          />
          <span className="text-slate-400">•</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Моё время
          </span>
          <span className="font-semibold text-slate-900">{myTrackedTimeLabel ?? '00:00:00'}</span>
        </div>

        {deal.closingReason && (
          <p className="text-xs text-slate-600">Причина закрытия: {deal.closingReason}</p>
        )}
      </div>
    </div>
  );
};
