import React from 'react';

import { Deal, Policy } from '../../../types';
import type { DealEvent } from './eventUtils';
import { formatDate, statusLabels } from './helpers';

interface DealDelayModalProps {
  deal: Deal;
  selectedEvent: DealEvent | null;
  selectedEventNextContact: string | null;
  upcomingEvents: DealEvent[];
  pastEvents: DealEvent[];
  relatedPolicies: Policy[];
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
  relatedPolicies,
  isSchedulingDelay,
  onClose,
  onEventSelect,
  onConfirm,
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Отложить до следующего события</h3>
          <p className="text-xs text-slate-500">{deal.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
      <div className="px-6 py-4 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Выбранное событие</p>
          {selectedEvent ? (
            <>
              <p className="text-sm font-semibold text-slate-900">{selectedEvent.title}</p>
              <p className="text-[12px] text-slate-500">{selectedEvent.description}</p>
              <p className="text-[11px] text-slate-500">Дата: {formatDate(selectedEvent.date)}</p>
              {selectedEventNextContact && (
                <p className="text-[11px] text-slate-500">
                  Новый следующий контакт: {formatDate(selectedEventNextContact)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Событие не выбрано.</p>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Предстоящие события</p>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              {upcomingEvents.length} найдено
            </span>
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
                    className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                        <p className="text-[12px] text-slate-500">{event.description}</p>
                      </div>
                      <span className="text-[12px] font-semibold text-slate-600">
                        {formatDate(event.date)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Предстоящие события не найдены.</p>
          )}
          {pastEvents.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">
                Старые события ({pastEvents.length})
              </summary>
              <div className="mt-3 space-y-2">
                {pastEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">{event.title}</p>
                      <p className="text-[12px] text-slate-500">{event.description}</p>
                    </div>
                    <span className="text-[11px] text-slate-500">{formatDate(event.date)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">Полисы в сделке</p>
          {relatedPolicies.length ? (
            <div className="space-y-2">
              {relatedPolicies.map((policy) => (
                <div key={policy.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {policy.number} · {policy.insuranceType}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {policy.insuranceCompany} · {formatDate(policy.startDate)} –{' '}
                    {formatDate(policy.endDate)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Привязанные полисы не найдены.</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedEvent || !selectedEventNextContact || isSchedulingDelay}
          className="px-3 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSchedulingDelay ? 'Сохраняю...' : 'Перенести следующий контакт'}
        </button>
      </div>
    </div>
  </div>
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
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Объединить сделки</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-xl leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Целевая сделка</p>
          <p className="text-base font-semibold text-slate-900">{targetDeal.title}</p>
          <p className="text-xs text-slate-500">Клиент: {selectedClientName}</p>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Выберите сделки для переноса</p>
          <input
            type="search"
            value={mergeSearch}
            onChange={(event) => onMergeSearchChange(event.target.value)}
            placeholder="Поиск по названию сделки"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
          />
          {mergeList.length ? (
            mergeList.map((deal) => (
              <label
                key={deal.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-slate-300"
              >
                <input
                  type="checkbox"
                  checked={mergeSources.includes(deal.id)}
                  onChange={() => toggleMergeSource(deal.id)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                  <p className="text-[11px] text-slate-500">
                    Стадия: {deal.stageName || '—'} · Статус:{' '}
                    {statusLabels[deal.status]}
                  </p>
                </div>
              </label>
            ))
          ) : (
            !isLoading && (
              <p className="text-sm text-slate-500">
                {isActiveSearch
                  ? `По запросу "${searchQuery}" ничего не найдено.`
                  : 'Нет других активных сделок у клиента.'}
              </p>
            )
          )}
          {isLoading && <p className="text-sm text-slate-500">Поиск...</p>}
        </div>
        {mergeError && <p className="text-sm font-medium text-rose-600">{mergeError}</p>}
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isMerging || !mergeSources.length}
          className="px-3 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isMerging ? 'Объединяем...' : 'Объединить сделки'}
        </button>
      </div>
    </div>
  </div>
);
