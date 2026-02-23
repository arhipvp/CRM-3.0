import React from 'react';
import type { Deal } from '../../../types';
import type { Client, DealSimilarityCandidate, User } from '../../../types';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../common/buttonStyles';
import { Modal } from '../../Modal';
import { DealForm, DealFormValues } from '../../forms/DealForm';
import type { DealEvent } from './eventUtils';
import { formatDate, statusLabels } from './helpers';

interface DealDelayModalProps {
  deal: Deal;
  selectedEvent: DealEvent | null;
  selectedEventNextContact: string | null;
  nextContactValue: string | null;
  upcomingEvents: DealEvent[];
  pastEvents: DealEvent[];
  isSchedulingDelay: boolean;
  isLeadDaysLoading?: boolean;
  validationError?: string | null;
  onClose: () => void;
  onEventSelect: (eventId: string) => void;
  onNextContactChange: (value: string) => void;
  onConfirm: () => void;
}

export const DealDelayModal: React.FC<DealDelayModalProps> = ({
  deal,
  selectedEvent,
  selectedEventNextContact,
  nextContactValue,
  upcomingEvents,
  pastEvents,
  isSchedulingDelay,
  isLeadDaysLoading,
  validationError,
  onClose,
  onEventSelect,
  onNextContactChange,
  onConfirm,
}) => (
  <Modal title="Отложить до следующего контакта" onClose={onClose} size="xl" zIndex={50}>
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="app-label">Сделка</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{deal.title}</p>
      </div>

      <div className="space-y-2">
        <p className="app-label">Выбранное событие</p>
        {selectedEvent ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{selectedEvent.title}</p>
                {selectedEvent.description && (
                  <p className="mt-1 text-sm text-slate-600">{selectedEvent.description}</p>
                )}
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {formatDate(selectedEvent.date)}
              </span>
            </div>
            {selectedEventNextContact && (
              <p className="mt-2 text-xs text-slate-600">
                Новый следующий контакт: {formatDate(selectedEventNextContact)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Событие не выбрано.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="app-label">Следующий контакт</p>
        <input
          type="date"
          value={nextContactValue ?? ''}
          max={selectedEvent?.date ?? undefined}
          onChange={(event) => onNextContactChange(event.target.value)}
          disabled={!selectedEvent || isSchedulingDelay || isLeadDaysLoading}
          className="field field-input"
        />
        <p className="text-xs text-slate-500">Дата должна быть не позже даты события.</p>
        {validationError && (
          <p className="text-xs font-semibold text-rose-600">{validationError}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Предстоящие события</p>
          <span className="text-xs text-slate-500">{upcomingEvents.length} найдено</span>
        </div>

        {upcomingEvents.length ? (
          <div className="space-y-3">
            {upcomingEvents.map((event) => {
              const isSelected = selectedEvent?.id === event.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEventSelect(event.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                      {event.description && (
                        <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-600">
                      {formatDate(event.date)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Предстоящих событий не найдено.</p>
        )}

        {pastEvents.length > 0 && (
          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Прошедшие события ({pastEvents.length})
            </summary>
            <div className="mt-3 space-y-2">
              {pastEvents.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    {event.description && (
                      <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatDate(event.date)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} className={`${BTN_SECONDARY} rounded-xl`}>
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedEvent || !nextContactValue || isSchedulingDelay}
          className={`${BTN_PRIMARY} rounded-xl`}
        >
          {isSchedulingDelay ? 'Переносим...' : 'Перенести следующий контакт'}
        </button>
      </div>
    </div>
  </Modal>
);

interface DealMergeModalProps {
  targetDeal: Deal;
  selectedClientName: string;
  clients: Client[];
  users: User[];
  mergeSearch: string;
  onMergeSearchChange: (value: string) => void;
  mergeList: Deal[];
  mergeSources: string[];
  toggleMergeSource: (dealId: string) => void;
  mergeError: string | null;
  mergePreviewWarnings: string[];
  mergeStep: 'select' | 'preview';
  onBackToSelection: () => void;
  mergeFinalDraft: DealFormValues | null;
  onPreview: () => void;
  isPreviewLoading: boolean;
  isPreviewConfirmed: boolean;
  isLoading: boolean;
  isActiveSearch: boolean;
  searchQuery: string;
  isMerging: boolean;
  onClose: () => void;
  onSubmit: (finalDeal: DealFormValues) => Promise<void>;
  onRequestAddClient: () => void;
}

export const DealMergeModal: React.FC<DealMergeModalProps> = ({
  targetDeal,
  selectedClientName,
  clients,
  users,
  mergeSearch,
  onMergeSearchChange,
  mergeList,
  mergeSources,
  toggleMergeSource,
  mergeError,
  mergePreviewWarnings,
  mergeStep,
  onBackToSelection,
  mergeFinalDraft,
  onPreview,
  isPreviewLoading,
  isPreviewConfirmed,
  isLoading,
  isActiveSearch,
  searchQuery,
  isMerging,
  onClose,
  onSubmit,
  onRequestAddClient,
}) => (
  <Modal title="Объединить сделки" onClose={onClose} size="xl" zIndex={50}>
    <div className="flex max-h-[85vh] flex-col" data-testid="deal-merge-modal-layout">
      <div className="min-h-0 space-y-4 overflow-y-auto pr-1" data-testid="deal-merge-modal-scroll">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="app-label">Целевая сделка</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{targetDeal.title}</p>
          <p className="mt-1 text-xs text-slate-600">Клиент: {selectedClientName}</p>
        </div>

        <div className="space-y-3">
          {mergeStep === 'select' ? (
            <>
              <p className="text-sm font-semibold text-slate-800">Выберите сделки для переноса</p>
              <input
                type="search"
                value={mergeSearch}
                onChange={(event) => onMergeSearchChange(event.target.value)}
                placeholder="Поиск по названию сделки"
                className="field field-input"
              />

              {mergeList.length ? (
                <div className="space-y-2">
                  {mergeList.map((deal) => (
                    <label
                      key={deal.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={mergeSources.includes(deal.id)}
                        onChange={() => toggleMergeSource(deal.id)}
                        className="check"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          Статус: {statusLabels[deal.status]}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                !isLoading && (
                  <p className="text-sm text-slate-600">
                    {isActiveSearch
                      ? `По запросу "${searchQuery}" ничего не найдено.`
                      : 'Нет подходящих сделок у клиента.'}
                  </p>
                )
              )}
              {isLoading && <p className="text-sm text-slate-600">Поиск...</p>}
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
                Будет создана новая объединённая сделка, выбранные исходные сделки будут
                архивированы.
              </div>
              {mergeFinalDraft && (
                <DealForm
                  clients={clients}
                  users={users}
                  mode="edit"
                  showSellerField
                  showNextContactField
                  showAddClientButton={false}
                  initialValues={mergeFinalDraft}
                  onRequestAddClient={onRequestAddClient}
                  submitLabel={isMerging ? 'Объединяем...' : 'Объединить сделки'}
                  submittingLabel="Объединяем..."
                  onSubmit={onSubmit}
                />
              )}
            </div>
          )}
          {mergeError && <p className="text-sm font-semibold text-rose-700">{mergeError}</p>}
          {mergePreviewWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Предупреждения предпросмотра
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
                {mergePreviewWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div
        className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white pb-1 pt-4"
        data-testid="deal-merge-modal-actions"
      >
        {mergeStep === 'select' && (
          <button
            type="button"
            onClick={onPreview}
            disabled={isPreviewLoading || mergeSources.length === 0}
            className={`${BTN_SECONDARY} rounded-xl`}
          >
            {isPreviewLoading ? 'Готовим предпросмотр...' : 'Предпросмотр'}
          </button>
        )}
        {mergeStep === 'preview' && (
          <button
            type="button"
            onClick={onBackToSelection}
            className={`${BTN_SECONDARY} rounded-xl`}
          >
            Назад к выбору
          </button>
        )}
        <button type="button" onClick={onClose} className={`${BTN_SECONDARY} rounded-xl`}>
          Отмена
        </button>
        {mergeStep === 'preview' && (
          <span
            className={`rounded-xl px-3 py-2 text-xs ${isPreviewConfirmed ? 'text-emerald-700' : 'text-slate-500'}`}
          >
            {isPreviewConfirmed ? 'Предпросмотр подтвержден' : 'Сначала выполните предпросмотр'}
          </span>
        )}
      </div>
    </div>
  </Modal>
);

interface DealSimilarModalProps {
  targetDeal: Deal;
  candidates: DealSimilarityCandidate[];
  selectedIds: string[];
  includeClosed: boolean;
  isLoading: boolean;
  error: string | null;
  onToggleIncludeClosed: (value: boolean) => void;
  onToggleCandidate: (dealId: string) => void;
  onContinue: () => void;
  onClose: () => void;
}

const confidenceStyles: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const similarityReasonLabels: Record<string, string> = {
  same_norm_title: 'Одинаковое название',
  similar_title: 'Похожее название',
  shared_policy_number: 'Есть общий номер полиса',
  shared_reference: 'Есть общий референс',
  same_source: 'Одинаковый источник',
  same_seller: 'Одинаковый продавец',
  same_executor: 'Одинаковый исполнитель',
  close_next_contact_date: 'Близкая дата следующего контакта',
  similar_description: 'Похожее описание',
};

export const DealSimilarModal: React.FC<DealSimilarModalProps> = ({
  targetDeal,
  candidates,
  selectedIds,
  includeClosed,
  isLoading,
  error,
  onToggleIncludeClosed,
  onToggleCandidate,
  onContinue,
  onClose,
}) => (
  <Modal title="Похожие сделки" onClose={onClose} size="xl" zIndex={50}>
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="app-label">Текущая сделка</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{targetDeal.title}</p>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={includeClosed}
          onChange={(event) => onToggleIncludeClosed(event.target.checked)}
          className="check"
        />
        Показывать закрытые сделки
      </label>

      {isLoading && <p className="text-sm text-slate-600">Ищем похожие сделки...</p>}

      {!isLoading && candidates.length === 0 && (
        <p className="text-sm text-slate-600">Похожие сделки не найдены.</p>
      )}

      {!isLoading && candidates.length > 0 && (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {candidates.map((candidate) => {
            const isSelected = selectedIds.includes(candidate.deal.id);
            return (
              <label
                key={candidate.deal.id}
                className="block cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 hover:border-slate-300"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleCandidate(candidate.deal.id)}
                    className="check mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{candidate.deal.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${confidenceStyles[candidate.confidence]}`}
                      >
                        score {candidate.score}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Статус: {statusLabels[candidate.deal.status]}
                    </p>
                    {candidate.reasons.length > 0 && (
                      <p className="mt-1 text-xs text-slate-600">
                        Причины:{' '}
                        {candidate.reasons
                          .map((reason) => similarityReasonLabels[reason] ?? reason)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} className={`${BTN_SECONDARY} rounded-xl`}>
          Отмена
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={selectedIds.length === 0 || isLoading}
          className={`${BTN_PRIMARY} rounded-xl`}
        >
          Перейти к объединению
        </button>
      </div>
    </div>
  </Modal>
);
