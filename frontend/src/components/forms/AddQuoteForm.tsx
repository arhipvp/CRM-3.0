import React, { useEffect, useState } from 'react';

import { fetchInsuranceCompanies, fetchInsuranceTypes } from '../../api';
import type { InsuranceCompany, InsuranceType } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { FormActions } from '../common/forms/FormActions';
import { FormError } from '../common/forms/FormError';
import { FormField } from '../common/forms/FormField';

export interface QuoteFormValues {
  insuranceCompanyId: string;
  insuranceTypeId: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  officialDealer: boolean;
  gap: boolean;
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
    initialValues?.insuranceCompanyId ?? '',
  );
  const [insuranceTypeId, setInsuranceTypeId] = useState(initialValues?.insuranceTypeId ?? '');
  const [sumInsured, setSumInsured] = useState(
    initialValues ? String(initialValues.sumInsured) : '',
  );
  const [premium, setPremium] = useState(initialValues ? String(initialValues.premium) : '');
  const [deductible, setDeductible] = useState(initialValues?.deductible ?? '');
  const [officialDealer, setOfficialDealer] = useState(initialValues?.officialDealer ?? false);
  const [gap, setGap] = useState(initialValues?.gap ?? false);
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
        if (!isMounted) {
          return;
        }
        setCompanies(companyList);
        setTypes(typeList);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setOptionsError('Не удалось загрузить список компаний и типов.');
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!insuranceCompanyId || !insuranceTypeId || !sumInsured || !premium) {
      setError('Заполните компанию, тип, сумму и премию.');
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
        officialDealer,
        gap,
        comments: comments.trim() || undefined,
      });
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось сохранить расчёт.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="app-panel p-6 shadow-none space-y-6">
      <FormError message={error} />
      <FormError message={optionsError} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Страховая компания" required>
          <select
            value={insuranceCompanyId}
            onChange={(event) => setInsuranceCompanyId(event.target.value)}
            disabled={loadingOptions}
            className="field field-input disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Выберите компанию</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Тип страхования" required>
          <select
            value={insuranceTypeId}
            onChange={(event) => setInsuranceTypeId(event.target.value)}
            disabled={loadingOptions}
            className="field field-input disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Выберите тип</option>
            {types.map((insuranceType) => (
              <option key={insuranceType.id} value={insuranceType.id}>
                {insuranceType.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Страховая сумма, ₽" required>
          <input
            type="number"
            min="0"
            step="0.01"
            value={sumInsured}
            onChange={(event) => setSumInsured(event.target.value)}
            className="field field-input"
          />
        </FormField>

        <FormField label="Премия, ₽" required>
          <input
            type="number"
            min="0"
            step="0.01"
            value={premium}
            onChange={(event) => setPremium(event.target.value)}
            className="field field-input"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={officialDealer}
            onChange={(event) => setOfficialDealer(event.target.checked)}
            className="check"
          />
          <span>Официальный дилер</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={gap}
            onChange={(event) => setGap(event.target.checked)}
            className="check"
          />
          <span>GAP</span>
        </label>
      </div>

      <FormField label="Франшиза">
        <input
          type="text"
          value={deductible}
          onChange={(event) => setDeductible(event.target.value)}
          className="field field-input"
        />
      </FormField>

      <FormField label="Комментарий">
        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={3}
          className="field-textarea"
        />
      </FormField>

      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isSubmitDisabled={loadingOptions}
        submitLabel={submitLabel}
        submitClassName="btn btn-primary rounded-xl"
        cancelClassName="btn btn-secondary rounded-xl"
      />

      {loadingOptions && <p className="mt-2 text-xs text-slate-500">Загружаю справочники...</p>}
    </form>
  );
};
