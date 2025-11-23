import React, { useEffect, useRef, useState } from 'react';

import { fetchInsuranceCompanies, fetchInsuranceTypes } from '../../api';
import type { Client, InsuranceCompany, InsuranceType, SalesChannel } from '../../types';
import type { FinancialRecordDraft } from './addPolicy/types';
import {
  createEmptyPayment,
  createEmptyRecord,
  PaymentDraft,
  PolicyFormValues,
} from './addPolicy/types';
import { PaymentSection } from './addPolicy/components/PaymentSection';

interface AddPolicyFormProps {
  onSubmit: (values: PolicyFormValues) => Promise<void>;
  onCancel: () => void;
  salesChannels: SalesChannel[];
  clients: Client[];
  initialValues?: PolicyFormValues;
  initialInsuranceCompanyName?: string;
  initialInsuranceTypeName?: string;
}

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({
  onSubmit,
  onCancel,
  salesChannels,
  clients,
  initialValues,
  initialInsuranceCompanyName,
  initialInsuranceTypeName,
}) => {
  const [number, setNumber] = useState('');
  const [clientId, setClientId] = useState('');
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [isVehicle, setIsVehicle] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [salesChannelId, setSalesChannelId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [activeRecordTab, setActiveRecordTab] = useState<Record<number, 'incomes' | 'expenses'>>({});

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

  useEffect(() => {
    if (!initialValues) {
      setNumber('');
      setInsuranceCompanyId('');
      setInsuranceTypeId('');
      setIsVehicle(false);
      setBrand('');
      setModel('');
      setVin('');
      setCounterparty('');
      setSalesChannelId('');
      setStartDate('');
      setEndDate('');
      setPayments([]);
      setClientId('');
      return;
    }
    setNumber(initialValues.number || '');
    setClientId(initialValues.clientId || '');
    setInsuranceCompanyId(initialValues.insuranceCompanyId);
    setInsuranceTypeId(initialValues.insuranceTypeId);
    setIsVehicle(initialValues.isVehicle);
    setBrand(initialValues.brand || '');
    setModel(initialValues.model || '');
    setVin(initialValues.vin || '');
    setCounterparty(initialValues.counterparty || '');
    setSalesChannelId(initialValues.salesChannelId || '');
    setStartDate(initialValues.startDate || '');
    setEndDate(initialValues.endDate || '');
    const initialPayments = initialValues.payments || [];
    setPayments(
      initialPayments.map((payment) => ({
        ...payment,
        incomes: payment.incomes ?? [],
        expenses: payment.expenses ?? [],
      }))
    );
  }, [initialValues]);

  useEffect(() => {
    if (!initialInsuranceCompanyName || !companies.length) {
      return;
    }
    const match = companies.find(
      (company) => company.name.toLowerCase() === initialInsuranceCompanyName.toLowerCase()
    );
    if (match) {
      setInsuranceCompanyId(match.id);
    }
  }, [initialInsuranceCompanyName, companies]);

  useEffect(() => {
    if (!initialInsuranceTypeName || !types.length) {
      return;
    }
    const match = types.find(
      (type) => type.name.toLowerCase() === initialInsuranceTypeName.toLowerCase()
    );
    if (match) {
      setInsuranceTypeId(match.id);
    }
  }, [initialInsuranceTypeName, types]);

  const getActiveTab = (paymentIndex: number) => activeRecordTab[paymentIndex] || 'incomes';

  const handleAddPayment = () => {
    setPayments((prev) => [...prev, createEmptyPayment()]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
    setActiveRecordTab((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updatePaymentField = (
    index: number,
    field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>,
    value: string
  ) => {
    setPayments((prev) =>
      prev.map((payment, idx) =>
        idx === index
          ? {
              ...payment,
              [field]: value,
            }
          : payment
      )
    );
  };

  const addRecord = (paymentIndex: number, type: 'incomes' | 'expenses') => {
    setPayments((prev) =>
      prev.map((payment, idx) =>
        idx === paymentIndex
          ? {
              ...payment,
              [type]: [...payment[type], createEmptyRecord()],
            }
          : payment
      )
    );
  };

  const updateRecordField = (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string
  ) => {
    setPayments((prev) =>
      prev.map((payment, idx) => {
        if (idx !== paymentIndex) return payment;
        const updatedRecords = payment[type].map((record, recIdx) =>
          recIdx === recordIndex
            ? {
                ...record,
                [field]: value,
              }
            : record
        );
        return {
          ...payment,
          [type]: updatedRecords,
        };
      })
    );
  };

  const removeRecord = (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => {
    setPayments((prev) =>
      prev.map((payment, idx) =>
        idx === paymentIndex
          ? {
              ...payment,
              [type]: payment[type].filter((_, recIdx) => recIdx !== recordIndex),
            }
          : payment
      )
    );
  };

  const suggestedExpenseDescriptionRef = useRef<string | null>(null);

  useEffect(() => {
    const trimmedCounterparty = counterparty.trim();
    if (!trimmedCounterparty) {
      if (!suggestedExpenseDescriptionRef.current || !payments.length) {
        suggestedExpenseDescriptionRef.current = null;
        return;
      }

      const descriptionToRemove = suggestedExpenseDescriptionRef.current;
      setPayments((prev) => {
        if (!prev.length) {
          return prev;
        }
        const firstPayment = prev[0];
        const filteredExpenses = firstPayment.expenses.filter(
          (record) =>
            !(
              record.amount === '0' &&
              record.description === descriptionToRemove
            )
        );
        if (filteredExpenses.length === firstPayment.expenses.length) {
          return prev;
        }
        return [
          { ...firstPayment, expenses: filteredExpenses },
          ...prev.slice(1),
        ];
      });
      suggestedExpenseDescriptionRef.current = null;
      return;
    }

    const expectedDescription = `выплата ${trimmedCounterparty}`;

    if (!payments.length) {
      suggestedExpenseDescriptionRef.current = expectedDescription;
      return;
    }

    setPayments((prev) => {
      if (!prev.length) {
        return prev;
      }
      const firstPayment = prev[0];
      const alreadyHasSuggestedExpense = firstPayment.expenses.some(
        (record) =>
          record.amount === '0' && record.description === expectedDescription
      );
      if (alreadyHasSuggestedExpense) {
        suggestedExpenseDescriptionRef.current = expectedDescription;
        return prev;
      }

      const previousDescription = suggestedExpenseDescriptionRef.current;
      const expensesWithoutPreviousSuggestion = previousDescription
        ? firstPayment.expenses.filter(
            (record) =>
              !(
                record.amount === '0' &&
                record.description === previousDescription
              )
          )
        : firstPayment.expenses;

      const suggestedExpense = {
        ...createEmptyRecord(),
        amount: '0',
        description: expectedDescription,
      };

      return [
        {
          ...firstPayment,
          expenses: [...expensesWithoutPreviousSuggestion, suggestedExpense],
        },
        ...prev.slice(1),
      ];
    });
    suggestedExpenseDescriptionRef.current = expectedDescription;
  }, [counterparty, payments.length]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim() || !insuranceCompanyId || !insuranceTypeId) {
      setError('Заполните обязательные поля номера и справочников');
      return;
    }

    if (!clientId) {
      setError('Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р°');
      return;
    }

    if (isVehicle && !vin.trim()) {
      setError('Укажите VIN, если полис для автомобиля');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onSubmit({
        number: number.trim(),
        clientId,
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
        payments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать полис');
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
            <option value="">Выберите страховую компанию</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">РљР»РёРµРЅС‚*</label>
        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          disabled={!clients.length}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
        >
          <option value="">Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р°</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {!clients.length && (
          <p className="text-xs text-slate-500 mt-1">
            РќРµС‚ РґРѕСЃС‚СѓРїРЅС‹С… РєР»РёРµРЅС‚РѕРІ. Р”РѕР±Р°РІСЊС‚Рµ РєР»РёРµРЅС‚Р° РІ РІРєР»Р°РґРєРµ "РљР»РёРµРЅС‚С‹".
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Тип страхования*</label>
          <select
            value={insuranceTypeId}
            onChange={(e) => setInsuranceTypeId(e.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Выберите тип страхования</option>
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
            placeholder="Компания / физлицо"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Канал продаж</label>
          <select
            value={salesChannelId}
            onChange={(event) => setSalesChannelId(event.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Выберите канал продаж</option>
            {salesChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Страхуется автомобиль</label>
          <label className="flex items-center gap-3 cursor-pointer mt-2">
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
            <span className="text-sm font-medium text-slate-700">Да</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Дата начала</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Дата окончания</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
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
              placeholder="Номер шасси (17 символов)"
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Платежи</h3>
          <button
            type="button"
            onClick={handleAddPayment}
            className="text-sm font-medium text-sky-600 hover:text-sky-800"
          >
            + Добавить платеж
          </button>
        </div>

        {payments.length === 0 && (
          <p className="text-xs text-slate-500">Добавьте хотя бы один платеж для расчета финансов</p>
        )}

        <div className="space-y-4">
          {payments.map((payment, paymentIndex) => (
            <PaymentSection
              key={paymentIndex}
              paymentIndex={paymentIndex}
              payment={payment}
              activeTab={getActiveTab(paymentIndex)}
              onFieldChange={updatePaymentField}
              onRemovePayment={handleRemovePayment}
              onTabChange={(index, tab) =>
                setActiveRecordTab((prev) => ({ ...prev, [index]: tab }))
              }
              onAddRecord={addRecord}
              onUpdateRecord={updateRecordField}
              onRemoveRecord={removeRecord}
            />
          ))}
        </div>
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
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Сохраняем...' : 'Создать полис'}
        </button>
      </div>
    </form>
  );
};
