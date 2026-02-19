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
}

const REASON_LABELS: Record<string, string> = {
  same_phone: 'Совпадает телефон',
  same_email: 'Совпадает email',
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
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Клиент</th>
                  <th className="px-3 py-2">Телефон</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Дата рождения</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Причины</th>
                  <th className="px-3 py-2 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {candidates.map((item) => (
                  <tr key={item.client.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-semibold text-slate-900">{item.client.name}</td>
                    <td className="px-3 py-2 text-slate-700">{item.client.phone || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{item.client.email || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatDateRu(item.client.birthDate)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {item.score}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {CONFIDENCE_LABELS[item.confidence]}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {item.reasons.map(mapReasonLabel).join(', ')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={BTN_SM_SECONDARY}
                        onClick={() => onMerge(item.client.id)}
                      >
                        Объединить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
