import React, { useEffect, useState } from 'react';

import { fetchInsuranceCompanies, fetchInsuranceTypes } from '../../api';
import type { InsuranceCompany, InsuranceType, PaymentStatus } from '../../types';

interface FinancialRecordDraft {
  amount: string;
  date?: string;
  description?: string;
  source?: string;
  note?: string;
}

interface PaymentDraft {
  amount: string;
  description?: string;
  scheduledDate?: string;
  actualDate?: string;
  status: PaymentStatus;
  incomes: FinancialRecordDraft[];
  expenses: FinancialRecordDraft[];
}

export interface PolicyFormValues {
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  startDate?: string | null;
  endDate?: string | null;
  payments: PaymentDraft[];
}

interface AddPolicyFormProps {
  onSubmit: (values: PolicyFormValues) => Promise<void>;
  onCancel: () => void;
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  planned: 'Запланирован',
  partial: 'Частично',
  paid: 'Оплачен',
};

const createEmptyRecord = (): FinancialRecordDraft => ({
  amount: '',
  date: '',
  description: '',
  source: '',
  note: '',
});

const createEmptyPayment = (): PaymentDraft => ({
  amount: '',
  description: '',
  scheduledDate: '',
  actualDate: '',
  status: 'planned',
  incomes: [],
  expenses: [],
});

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({ onSubmit, onCancel }) => {
  const [number, setNumber] = useState('');
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [isVehicle, setIsVehicle] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [counterparty, setCounterparty] = useState('');
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
    value: string | PaymentStatus
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

  const renderRecordInputs = (paymentIndex: number, type: 'incomes' | 'expenses', records: FinancialRecordDraft[]) =>
    records.map((record, recordIndex) => (
      <div key={`${type}-${recordIndex}`} className="border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-900">
            {type === 'incomes' ? 'Доход' : 'Расход'} #{recordIndex + 1}
          </span>
          <button
            type="button"
            className="text-xs text-red-500 hover:underline"
            onClick={() => removeRecord(paymentIndex, type, recordIndex)}
          >
            Удалить
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">РЎСѓРјРјР°, в'Ѕ</label>
            <input
              type="number"
              value={record.amount}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'amount', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Дата</label>
            <input
              type="date"
              value={record.date || ''}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'date', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Описание</label>
            <input
              type="text"
              value={record.description || ''}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'description', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Рсточник</label>
            <input
              type="text"
              value={record.source || ''}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'source', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Применение</label>
            <input
              type="text"
              value={record.note || ''}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'note', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>
    ));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!number.trim() || !insuranceCompanyId || !insuranceTypeId) {
      setError('Заполните обязательные поля номера и справочников');
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
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand: isVehicle ? brand.trim() || undefined : undefined,
        model: isVehicle ? model.trim() || undefined : undefined,
        vin: isVehicle ? vin.trim() : undefined,
        counterparty: counterparty.trim() || undefined,
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

  const renderTabsForPayment = (paymentIndex: number) => (
    <div className="flex gap-2">
      {(['incomes', 'expenses'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`px-3 py-1 text-xs font-medium rounded-full border ${
            getActiveTab(paymentIndex) === tab
              ? 'border-sky-600 text-sky-600 bg-sky-50'
              : 'border-slate-200 text-slate-500'
          }`}
          onClick={() => setActiveRecordTab((prev) => ({ ...prev, [paymentIndex]: tab }))}
        >
          {tab === 'incomes' ? 'Доходы' : 'Расходы'}
        </button>
      ))}
    </div>
  );

  const renderRecordSection = (paymentIndex: number) => {
    const activeTab = getActiveTab(paymentIndex);
    const label = activeTab === 'incomes' ? 'Доходы' : 'Расходы';
    const records = payments[paymentIndex][activeTab];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-700">{label}</h4>
          <button
            type="button"
            className="text-xs text-sky-600 hover:underline"
            onClick={() => addRecord(paymentIndex, activeTab)}
          >
            + Добавить {activeTab === 'incomes' ? 'доход' : 'расход'}
          </button>
        </div>
        {records.length ? renderRecordInputs(paymentIndex, activeTab, records) : (
          <p className="text-xs text-slate-500">Пока нет {label.toLowerCase()}</p>
        )}
      </div>
    );
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div key={paymentIndex} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">Платеж #{paymentIndex + 1}</span>
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => handleRemovePayment(paymentIndex)}
                >
                  Удалить платеж
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">РЎСѓРјРјР°, в'Ѕ</label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => updatePaymentField(paymentIndex, 'amount', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Статус</label>
                  <select
                    value={payment.status}
                    onChange={(e) =>
                      updatePaymentField(paymentIndex, 'status', e.target.value as PaymentStatus)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm bg-white focus:border-sky-500 focus:ring-sky-500"
                  >
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Дата плановая</label>
                  <input
                    type="date"
                    value={payment.scheduledDate || ''}
                    onChange={(e) => updatePaymentField(paymentIndex, 'scheduledDate', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Дата фактическая</label>
                  <input
                    type="date"
                    value={payment.actualDate || ''}
                    onChange={(e) => updatePaymentField(paymentIndex, 'actualDate', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Описание</label>
                  <input
                    type="text"
                    value={payment.description || ''}
                    onChange={(e) => updatePaymentField(paymentIndex, 'description', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {renderTabsForPayment(paymentIndex)}
                <div className="rounded-xl border border-slate-200 p-3">
                  {renderRecordSection(paymentIndex)}
                </div>
              </div>
            </div>
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

