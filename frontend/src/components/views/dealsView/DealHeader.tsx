import { ColoredLabel } from '../../common/ColoredLabel';
import { useNotification } from '../../../contexts/NotificationContext';
import type { Client, ClientDuplicateHint, Deal } from '../../../types';
import { copyToClipboard } from '../../../utils/clipboard';
import { buildTelegramLink, buildWhatsAppLink } from '../../../utils/links';
import { ClientNameIndicators } from '../../clients/ClientNameIndicators';
import { AppIcon } from '../../common/AppIcon';
import { IconButton } from '../../common/Button';

interface DealHeaderProps {
  deal: Deal;
  clientDisplayName: string;
  client?: Client | null;
  clientDuplicateHint?: ClientDuplicateHint;
  clientPhone?: string;
  sellerDisplayName: string;
  executorDisplayName: string;
  myTrackedTimeLabel?: string;
  onClientEdit?: (client: Client) => void;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
}

export const DealHeader: React.FC<DealHeaderProps> = ({
  deal,
  clientDisplayName,
  client,
  clientDuplicateHint,
  clientPhone,
  sellerDisplayName,
  executorDisplayName,
  myTrackedTimeLabel,
  onClientEdit,
  onClientFindSimilar,
  onClientNormalizeName,
}) => {
  const { addNotification } = useNotification();
  const whatsAppLink = buildWhatsAppLink(clientPhone);
  const telegramLink = buildTelegramLink(clientPhone);
  const clientNote = client?.notes?.trim();
  const shortDealId = deal.id.slice(0, 8);

  const handleCopyDealId = async () => {
    const copied = await copyToClipboard(shortDealId);
    if (copied) {
      addNotification('ID сделки скопирован', 'success', 1600);
      return;
    }
    addNotification('Не удалось скопировать ID сделки', 'error', 2000);
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <span>Сделка</span>
            <button
              type="button"
              onClick={() => {
                void handleCopyDealId();
              }}
              className="cursor-pointer font-medium tracking-[0.18em] text-slate-400 transition hover:text-slate-600 focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
              title={deal.id}
              aria-label={`ID сделки ${deal.id}`}
            >
              #{shortDealId}
            </button>
          </p>
          <h2 className="text-xl font-semibold leading-tight text-slate-900">{deal.title}</h2>
        </div>

        {deal.description && (
          <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{deal.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Контактное лицо
          </span>
          <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
            <ClientNameIndicators
              client={client}
              hint={clientDuplicateHint}
              onFindSimilar={onClientFindSimilar}
              onNormalizeName={onClientNormalizeName}
            />
            {clientDisplayName}
            {clientNote && (
              <span className="text-xs font-semibold text-rose-600">- {clientNote}</span>
            )}
            {client && onClientEdit && (
              <IconButton
                onClick={() => onClientEdit(client)}
                icon="edit"
                label={`Редактировать клиента ${client.name}`}
                tone="primary"
                size="sm"
                title="Редактировать"
              />
            )}
            {whatsAppLink && (
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Написать клиенту в WhatsApp"
                className="icon-btn h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              >
                <AppIcon name="whatsapp" size={16} />
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
                <AppIcon name="telegram" size={16} />
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
