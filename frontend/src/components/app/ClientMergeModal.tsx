import React from 'react';

import { BTN_PRIMARY, BTN_SECONDARY } from '../common/buttonStyles';
import { FormActions } from '../common/forms/FormActions';
import { FormModal } from '../common/modal/FormModal';
import type { Client, ClientMergePreviewResponse } from '../../types';

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
  mergeError: string | null;
  isMergingClients: boolean;
  isPreviewLoading: boolean;
  isPreviewConfirmed: boolean;
  fieldOverrides: ClientMergeFieldOverrides;
  onClose: () => void;
  onSubmit: () => Promise<void>;
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
  mergeError,
  isMergingClients,
  isPreviewLoading,
  isPreviewConfirmed,
  fieldOverrides,
  onClose,
  onSubmit,
  onPreview,
  onToggleSource,
  onSearchChange,
  onFieldOverridesChange,
}) => (
  <FormModal isOpen title={`Объединить клиента ${targetClient.name}`} onClose={onClose} size="lg">
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
      className="space-y-5"
    >
      <p className="text-sm text-slate-600">
        Выберите клиентов, которые будут объединены в «{targetClient.name}».
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
      {mergeError && <p className="text-sm text-rose-600">{mergeError}</p>}
      <FormActions
        onCancel={onClose}
        isSubmitting={isMergingClients}
        isSubmitDisabled={!mergeSources.length || !isPreviewConfirmed}
        submitLabel="Объединить клиентов"
        submittingLabel="Объединяем..."
        submitClassName={`${BTN_PRIMARY} rounded-xl`}
        cancelClassName={`${BTN_SECONDARY} rounded-xl`}
      />
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
    </form>
  </FormModal>
);
