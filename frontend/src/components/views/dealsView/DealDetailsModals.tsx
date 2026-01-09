import React from 'react';
import type { Deal } from '../../../types';
import { Modal } from '../../Modal';
import type { DealEvent } from './eventUtils';
import { formatDate, statusLabels } from './helpers';

interface DealDelayModalProps {
  deal: Deal;
  selectedEvent: DealEvent | null;
  selectedEventNextContact: string | null;
  upcomingEvents: DealEvent[];
  pastEvents: DealEvent[];
  isSchedulingDelay: boolean;
  onClose: () => void;
  onEventSelect: (eventId: string) => void;
  onConfirm: () => void;
}

export const DealDelayModal: React.FC<DealDelayModalProps> = ({
  deal,
  selectedEvent,
  selectedEventNextContact,
  upcomingEvents,
  pastEvents,
  isSchedulingDelay,
  onClose,
  onEventSelect,
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
        <button type="button" onClick={onClose} className="btn btn-secondary rounded-xl">
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedEvent || isSchedulingDelay}
          className="btn btn-primary rounded-xl"
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
  mergeSearch: string;
  onMergeSearchChange: (value: string) => void;
  mergeList: Deal[];
  mergeSources: string[];
  toggleMergeSource: (dealId: string) => void;
  mergeError: string | null;
  isLoading: boolean;
  isActiveSearch: boolean;
  searchQuery: string;
  isMerging: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const DealMergeModal: React.FC<DealMergeModalProps> = ({
  targetDeal,
  selectedClientName,
  mergeSearch,
  onMergeSearchChange,
  mergeList,
  mergeSources,
  toggleMergeSource,
  mergeError,
  isLoading,
  isActiveSearch,
  searchQuery,
  isMerging,
  onClose,
  onSubmit,
}) => (
  <Modal title="Объединить сделки" onClose={onClose} size="xl" zIndex={50}>
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <p className="app-label">Целевая сделка</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{targetDeal.title}</p>
        <p className="mt-1 text-xs text-slate-600">Клиент: {selectedClientName}</p>
      </div>

      <div className="space-y-3">
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
        {mergeError && <p className="text-sm font-semibold text-rose-700">{mergeError}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} className="btn btn-secondary rounded-xl">
          Отмена
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isMerging || mergeSources.length === 0}
          className="btn btn-primary rounded-xl"
        >
          {isMerging ? 'Объединяем...' : 'Объединить сделки'}
        </button>
      </div>
    </div>
  </Modal>
);
