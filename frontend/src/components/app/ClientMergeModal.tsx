import React from 'react';

import { BTN_PRIMARY, BTN_SECONDARY } from '../common/buttonStyles';
import { FormActions } from '../common/forms/FormActions';
import { FormModal } from '../common/modal/FormModal';
import type { Client, ClientMergePreviewResponse, ClientMergeSessionStatus } from '../../types';

type ClientMergeFieldOverrides = {
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type ClientMergeStep = 'select' | 'preview';

type ClientMergeModalProps = {
  targetClient: Client;
  mergeCandidates: Client[];
  mergeSearch: string;
  mergeSources: string[];
  mergeStep: ClientMergeStep;
  mergePreview: ClientMergePreviewResponse | null;
  mergeSession: ClientMergeSessionStatus | null;
  mergeError: string | null;
  isMergingClients: boolean;
  isPreviewLoading: boolean;
  isPreviewConfirmed: boolean;
  fieldOverrides: ClientMergeFieldOverrides;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onRetry: () => Promise<void>;
  onPreview: () => Promise<void>;
  onToggleSource: (clientId: string) => void;
  onSearchChange: (value: string) => void;
  onFieldOverridesChange: (value: ClientMergeFieldOverrides) => void;
};

export const ClientMergeModal: React.FC<ClientMergeModalProps> = ({
  targetClient,
  mergeCandidates,
  mergeSearch,
  mergeSources,
  mergeStep,
  mergePreview,
  mergeSession,
  mergeError,
  isMergingClients,
  isPreviewLoading,
  isPreviewConfirmed,
  fieldOverrides,
  onClose,
  onSubmit,
  onRetry,
  onPreview,
  onToggleSource,
  onSearchChange,
  onFieldOverridesChange,
}) => {
  const totalItems = mergeSession?.totalItems ?? 0;
  const movedItems = mergeSession?.movedItems ?? 0;
  const progressValue = totalItems > 0 ? Math.round((movedItems / totalItems) * 100) : 0;
  const isRetryableFailure = mergeSession?.status === 'failed' && mergeSession.retryable;
  const isFinalizing = mergeSession?.status === 'ready_to_finalize' && isMergingClients;
  const progressText = isFinalizing
    ? 'Финализируем объединение'
    : totalItems > 0
      ? `Переносим документы ${movedItems}/${totalItems}`
      : 'Готовим объединение';

  return (
    <FormModal isOpen title={`Объединить клиента ${targetClient.name}`} onClose={onClose} size="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
        className="space-y-5"
      >
        <p className="text-sm text-slate-600">
          {mergeStep === 'preview'
            ? `Проверьте, какие данные будут перенесены в «${targetClient.name}».`
            : `Выберите клиентов, которые будут объединены в «${targetClient.name}».`}
        </p>
        {mergeStep === 'select' && (
          <>
            <input
              type="search"
              value={mergeSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Поиск по имени клиента"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
            />
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {mergeCandidates.length ? (
                mergeCandidates.map((client) => (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={mergeSources.includes(client.id)}
                      onChange={() => onToggleSource(client.id)}
                      className="check"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-500">
                        {[client.phone || '', client.email || '', client.birthDate || '']
                          .filter(Boolean)
                          .join(' · ') || 'Контакты не заполнены'}
                      </p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {!mergeSearch
                    ? 'Нет доступных клиентов для объединения.'
                    : `По запросу "${mergeSearch}" ничего не найдено.`}
                </p>
              )}
            </div>
          </>
        )}
        {mergeStep === 'preview' && mergePreview && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Предпросмотр объединения</p>
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
              <p>Сделок к переносу: {String(mergePreview.movedCounts?.deals ?? 0)}</p>
              <p>Полисов к переносу: {String(mergePreview.movedCounts?.policies_unique ?? 0)}</p>
            </div>
            {mergePreview.canonicalProfile.candidates && (
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-3">
                <p>
                  ФИО: {(mergePreview.canonicalProfile.candidates.names ?? []).join(', ') || '—'}
                </p>
                <p>
                  Телефоны:{' '}
                  {(mergePreview.canonicalProfile.candidates.phones ?? []).join(', ') || '—'}
                </p>
                <p>
                  Email: {(mergePreview.canonicalProfile.candidates.emails ?? []).join(', ') || '—'}
                </p>
              </div>
            )}
            {Array.isArray(mergePreview.warnings) && mergePreview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Предупреждения
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
                  {mergePreview.warnings.map((warning) => (
                    <li key={String(warning)}>{String(warning)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Итоговое ФИО
                <input
                  type="text"
                  value={fieldOverrides.name}
                  onChange={(event) =>
                    onFieldOverridesChange({
                      ...fieldOverrides,
                      name: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                />
              </label>
              <label className="text-sm text-slate-700">
                Итоговый телефон
                <input
                  type="text"
                  value={fieldOverrides.phone}
                  onChange={(event) =>
                    onFieldOverridesChange({
                      ...fieldOverrides,
                      phone: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                />
              </label>
              <label className="text-sm text-slate-700">
                Итоговый email
                <input
                  type="email"
                  value={fieldOverrides.email}
                  onChange={(event) =>
                    onFieldOverridesChange({
                      ...fieldOverrides,
                      email: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                Итоговые заметки
                <textarea
                  value={fieldOverrides.notes}
                  onChange={(event) =>
                    onFieldOverridesChange({
                      ...fieldOverrides,
                      notes: event.target.value,
                    })
                  }
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                />
              </label>
            </div>
          </div>
        )}
        {mergeSession && (
          <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50 p-3">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
              <span>{progressText}</span>
              <span className="font-medium text-slate-900">{progressValue}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalItems || 1}
              aria-valuenow={movedItems}
            >
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        )}
        {mergeError && <p className="text-sm text-rose-600">{mergeError}</p>}
        {isRetryableFailure && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                void onRetry();
              }}
              disabled={isMergingClients}
              className={`${BTN_PRIMARY} rounded-xl`}
            >
              {isMergingClients ? 'Продолжаем...' : 'Повторить'}
            </button>
          </div>
        )}
        <FormActions
          onCancel={onClose}
          isSubmitting={isMergingClients}
          isSubmitDisabled={!mergeSources.length || !isPreviewConfirmed || isRetryableFailure}
          submitLabel="Объединить клиентов"
          submittingLabel={isFinalizing ? 'Финализируем...' : 'Объединяем...'}
          submitClassName={`${BTN_PRIMARY} rounded-xl`}
          cancelClassName={`${BTN_SECONDARY} rounded-xl`}
        />
        {mergeStep === 'select' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                void onPreview();
              }}
              disabled={isPreviewLoading || !mergeSources.length}
              className={`${BTN_SECONDARY} rounded-xl`}
            >
              {isPreviewLoading ? 'Готовим предпросмотр...' : 'Предпросмотр объединения'}
            </button>
          </div>
        )}
      </form>
    </FormModal>
  );
};
