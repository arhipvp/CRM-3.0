import React, { useEffect, useState } from 'react';

import {
  fetchInsuranceCompanies,
  fetchInsuranceTypes,
} from '../../api';
import type { InsuranceCompany, InsuranceType } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

export interface QuoteFormValues {
  insuranceCompanyId: string;
  insuranceTypeId: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
}

interface AddQuoteFormProps {
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  onCancel: () => void;
  initialValues?: QuoteFormValues;
  submitLabel?: string;
}

export const AddQuoteForm: React.FC<AddQuoteFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Сохранить',
}) => {
  const [insuranceCompanyId, setInsuranceCompanyId] = useState(
    initialValues?.insuranceCompanyId ?? ''
  );
  const [insuranceTypeId, setInsuranceTypeId] = useState(initialValues?.insuranceTypeId ?? '');
  const [sumInsured, setSumInsured] = useState(
    initialValues ? String(initialValues.sumInsured) : ''
  );
  const [premium, setPremium] = useState(
    initialValues ? String(initialValues.premium) : ''
  );
  const [deductible, setDeductible] = useState(initialValues?.deductible ?? '');
  const [comments, setComments] = useState(initialValues?.comments ?? '');
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [types, setTypes] = useState<InsuranceType[]>([]);

  useEffect(() => {
    let isMounted = true;
    setOptionsError(null);

    Promise.all([fetchInsuranceCompanies(), fetchInsuranceTypes()])
      .then(([companyList, typeList]) => {
        if (!isMounted) return;
        setCompanies(companyList);
        setTypes(typeList);
      })
      .catch(() => {
        if (!isMounted) return;
        setOptionsError('Не удалось загрузить справочники страхования');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!insuranceCompanyId || !insuranceTypeId || !sumInsured || !premium) {
      setError('Заполните компанию, тип, сумму и премию');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        insuranceCompanyId,
        insuranceTypeId,
        sumInsured: Number(sumInsured),
        premium: Number(premium),
        deductible: deductible.trim() || undefined,
        comments: comments.trim() || undefined,
      });
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось сохранить расчет'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>}
      {optionsError && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{optionsError}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Страховая компания*
          </label>
          <select
            value={insuranceCompanyId}
            onChange={(event) => setInsuranceCompanyId(event.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Выберите компанию</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Тип страхования*</label>
          <select
            value={insuranceTypeId}
            onChange={(event) => setInsuranceTypeId(event.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Выберите тип</option>
            {types.map((insuranceType) => (
              <option key={insuranceType.id} value={insuranceType.id}>
                {insuranceType.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Страховая сумма, ₽*
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={sumInsured}
            onChange={(event) => setSumInsured(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Премия, ₽*</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={premium}
            onChange={(event) => setPremium(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Франшиза</label>
        <input
          type="text"
          value={deductible}
          onChange={(event) => setDeductible(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Комментарий</label>
        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          disabled={isSubmitting}
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting || loadingOptions}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Сохраняем...' : submitLabel}
        </button>
      </div>
      {loadingOptions && (
        <p className="text-xs text-slate-500 mt-2">Загружаем справочники...</p>
      )}
    </form>
  );
};
