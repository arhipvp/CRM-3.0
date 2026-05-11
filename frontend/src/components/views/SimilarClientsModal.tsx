import React from 'react';
import { BTN_SM_SECONDARY } from '../common/buttonStyles';
import { Modal } from '../Modal';
import { formatDateRu } from '../../utils/formatting';
import type { Client, ClientSimilarityCandidate } from '../../types';

interface SimilarClientsModalProps {
  isOpen: boolean;
  targetClient: Client | null;
  candidates: ClientSimilarityCandidate[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onMerge: (candidateClientId: string) => void;
  onExclude: (candidateClientId: string) => void | Promise<void>;
}

const REASON_LABELS: Record<string, string> = {
  same_phone: 'Совпадает телефон',
  same_email: 'Совпадает email',
  same_surname_name: 'Совпадают фамилия и имя',
  short_full_name_match: 'У одного клиента нет отчества',
  name_patronymic_birthdate_match: 'Совпадают имя + отчество + дата рождения',
  same_full_name: 'Совпадает полное ФИО',
  same_birth_date_only: 'Совпадает дата рождения',
  phone_or_email_missing_penalty: 'Недостаточно контактов для уверенного матча',
};

const CONFIDENCE_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const mapReasonLabel = (reason: string): string => REASON_LABELS[reason] ?? reason;

export const SimilarClientsModal: React.FC<SimilarClientsModalProps> = ({
  isOpen,
  targetClient,
  candidates,
  isLoading,
  error,
  onClose,
  onMerge,
  onExclude,
}) => {
  if (!isOpen || !targetClient) {
    return null;
  }

  return (
    <Modal title={`Похожие клиенты: ${targetClient.name}`} onClose={onClose} size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Найденные кандидаты на объединение для клиента{' '}
          <span className="font-semibold">{targetClient.name}</span>.
        </p>
        {isLoading && <p className="text-sm text-slate-500">Ищем похожих клиентов...</p>}
        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {!isLoading && !error && candidates.length === 0 && (
          <p className="text-sm text-slate-500">Похожих клиентов не найдено.</p>
        )}
        {!isLoading && !error && candidates.length > 0 && (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {candidates.map((item) => (
              <article
                key={item.client.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <p className="break-words font-semibold text-slate-900">{item.client.name}</p>
                      <p className="text-xs text-slate-500">
                        Score {item.score} · {CONFIDENCE_LABELS[item.confidence]}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
                      <p>
                        <span className="font-semibold text-slate-700">Телефон:</span>{' '}
                        {item.client.phone || '-'}
                      </p>
                      <p className="break-words">
                        <span className="font-semibold text-slate-700">Email:</span>{' '}
                        {item.client.email || '-'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Дата рождения:</span>{' '}
                        {formatDateRu(item.client.birthDate)}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <p className="break-words">{item.reasons.map(mapReasonLabel).join(', ')}</p>
                      {item.relationCounts && (
                        <p className="text-[11px] text-slate-500">
                          Сделок: {item.relationCounts.deals ?? 0}, полисов:{' '}
                          {item.relationCounts.policies ?? 0}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 self-start md:justify-end">
                    <button
                      type="button"
                      className={BTN_SM_SECONDARY}
                      onClick={() => {
                        void onExclude(item.client.id);
                      }}
                    >
                      Это разные
                    </button>
                    <button
                      type="button"
                      className={BTN_SM_SECONDARY}
                      onClick={() => onMerge(item.client.id)}
                    >
                      Объединить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
