import React, { useEffect, useState } from 'react';

import { fetchInsuranceCompanies, fetchInsuranceTypes } from '../../api';
import type { InsuranceCompany, InsuranceType, SalesChannel } from '../../types';
import type { PolicyEditFormValues } from './editPolicy/types';

interface EditPolicyFormProps {
  initialValues: PolicyEditFormValues;
  salesChannels: SalesChannel[];
  onSubmit: (values: PolicyEditFormValues) => Promise<void>;
  onCancel: () => void;
}

export const EditPolicyForm: React.FC<EditPolicyFormProps> = ({
  initialValues,
  salesChannels,
  onSubmit,
  onCancel,
}) => {
  const [number, setNumber] = useState(initialValues.number);
  const [insuranceCompanyId, setInsuranceCompanyId] = useState(initialValues.insuranceCompanyId);
  const [insuranceTypeId, setInsuranceTypeId] = useState(initialValues.insuranceTypeId);
  const [counterparty, setCounterparty] = useState(initialValues.counterparty || '');
  const [salesChannelId, setSalesChannelId] = useState(initialValues.salesChannelId || '');
  const [startDate, setStartDate] = useState(initialValues.startDate || '');
  const [endDate, setEndDate] = useState(initialValues.endDate || '');
  const [isVehicle, setIsVehicle] = useState(initialValues.isVehicle);
  const [brand, setBrand] = useState(initialValues.brand || '');
  const [model, setModel] = useState(initialValues.model || '');
  const [vin, setVin] = useState(initialValues.vin || '');
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoadingOptions(true);
    Promise.all([fetchInsuranceCompanies(), fetchInsuranceTypes()])
      .then(([companyList, typeList]) => {
        if (!isMounted) return;
        setCompanies(companyList);
        setTypes(typeList);
      })
      .catch(() => {
        if (!isMounted) return;
        setOptionsError('Не удалось загрузить списки страховых компаний и типов.');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoadingOptions(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!initialValues) {
      return;
    }
    setNumber(initialValues.number);
    setInsuranceCompanyId(initialValues.insuranceCompanyId);
    setInsuranceTypeId(initialValues.insuranceTypeId);
    setCounterparty(initialValues.counterparty || '');
    setSalesChannelId(initialValues.salesChannelId || '');
    setStartDate(initialValues.startDate || '');
    setEndDate(initialValues.endDate || '');
    setIsVehicle(initialValues.isVehicle);
    setBrand(initialValues.brand || '');
    setModel(initialValues.model || '');
    setVin(initialValues.vin || '');
  }, [initialValues]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim() || !insuranceCompanyId || !insuranceTypeId) {
      setError('Заполните номер, страховую компанию и тип полиса.');
      return;
    }
    if (isVehicle && !vin.trim()) {
      setError('Укажите VIN для транспортного полиса.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        number: number.trim(),
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand: isVehicle ? brand.trim() || undefined : undefined,
        model: isVehicle ? model.trim() || undefined : undefined,
        vin: isVehicle ? vin.trim() : undefined,
        counterparty: counterparty.trim() || undefined,
        salesChannelId: salesChannelId || undefined,
        startDate: startDate || null,
        endDate: endDate || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить полис.');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || optionsError) && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error || optionsError}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Номер полиса*</label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="001234567890"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Страховая компания*</label>
          <select
            value={insuranceCompanyId}
            onChange={(e) => setInsuranceCompanyId(e.target.value)}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Тип страхования*</label>
          <select
            value={insuranceTypeId}
            onChange={(e) => setInsuranceTypeId(e.target.value)}
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
          <label className="block text-sm font-medium text-slate-700">Контрагент</label>
          <input
            type="text"
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="Контрагент или брокер"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Канал продаж</label>
          <select
            value={salesChannelId}
            onChange={(event) => setSalesChannelId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500"
          >
            <option value="">Выберите канал</option>
            {salesChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Начало</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Окончание</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isVehicle}
            onChange={(e) => {
              if (!e.target.checked) {
                setBrand('');
                setModel('');
                setVin('');
              }
              setIsVehicle(e.target.checked);
            }}
            className="rounded border-slate-300"
          />
          <span className="text-sm font-medium text-slate-700">Транспортный полис</span>
        </label>
      </div>

      {isVehicle && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Марка</label>
            <input
              type="text"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              placeholder="Toyota"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Модель</label>
            <input
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              placeholder="Camry"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">VIN</label>
            <input
              type="text"
              value={vin}
              onChange={(event) => setVin(event.target.value)}
              maxLength={17}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              placeholder="17 символов"
            />
          </div>
        </div>
      )}

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
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
};
