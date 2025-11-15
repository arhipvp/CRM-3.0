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
  planned: 'Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅ',
  partial: 'Р§Р°СЃС‚РёС‡РЅРѕ',
  paid: 'РћРїР»Р°С‡РµРЅ',
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
        setOptionsError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїСЂР°РІРѕС‡РЅРёРєРё СЃС‚СЂР°С…РѕРІР°РЅРёСЏ');
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
            {type === 'incomes' ? 'Р”РѕС…РѕРґ' : 'Р Р°СЃС…РѕРґ'} #{recordIndex + 1}
          </span>
          <button
            type="button"
            className="text-xs text-red-500 hover:underline"
            onClick={() => removeRecord(paymentIndex, type, recordIndex)}
          >
            РЈРґР°Р»РёС‚СЊ
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">РЎСѓРјРјР°, в‚Ѕ</label>
            <input
              type="number"
              value={record.amount}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'amount', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Р”Р°С‚Р°</label>
            <input
              type="date"
              value={record.date || ''}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'date', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">РћРїРёСЃР°РЅРёРµ</label>
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
            <label className="block text-xs font-medium text-slate-600">РСЃС‚РѕС‡РЅРёРє</label>
            <input
              type="text"
              value={record.source || ''}
              onChange={(e) => updateRecordField(paymentIndex, type, recordIndex, 'source', e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">РџСЂРёРјРµРЅРµРЅРёРµ</label>
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
      setError('Р—Р°РїРѕР»РЅРёС‚Рµ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ РЅРѕРјРµСЂР° Рё СЃРїСЂР°РІРѕС‡РЅРёРєРѕРІ');
      return;
    }

    if (isVehicle && !vin.trim()) {
      setError('РЈРєР°Р¶РёС‚Рµ VIN, РµСЃР»Рё РїРѕР»РёСЃ РґР»СЏ Р°РІС‚РѕРјРѕР±РёР»СЏ');
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
      setError(err instanceof Error ? err.message : 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїРѕР»РёСЃ');
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
          {tab === 'incomes' ? 'Р”РѕС…РѕРґС‹' : 'Р Р°СЃС…РѕРґС‹'}
        </button>
      ))}
    </div>
  );

  const renderRecordSection = (paymentIndex: number) => {
    const activeTab = getActiveTab(paymentIndex);
    const label = activeTab === 'incomes' ? 'Р”РѕС…РѕРґС‹' : 'Р Р°СЃС…РѕРґС‹';
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
            + Р”РѕР±Р°РІРёС‚СЊ {activeTab === 'incomes' ? 'РґРѕС…РѕРґ' : 'СЂР°СЃС…РѕРґ'}
          </button>
        </div>
        {records.length ? renderRecordInputs(paymentIndex, activeTab, records) : (
          <p className="text-xs text-slate-500">РџРѕРєР° РЅРµС‚ {label.toLowerCase()}</p>
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
          <label className="block text-sm font-medium text-slate-700">РќРѕРјРµСЂ РїРѕР»РёСЃР°*</label>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="001234567890"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">РЎС‚СЂР°С…РѕРІР°СЏ РєРѕРјРїР°РЅРёСЏ*</label>
          <select
            value={insuranceCompanyId}
            onChange={(e) => setInsuranceCompanyId(e.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Р’С‹Р±РµСЂРёС‚Рµ СЃС‚СЂР°С…РѕРІСѓСЋ РєРѕРјРїР°РЅРёСЋ</option>
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
          <label className="block text-sm font-medium text-slate-700">РўРёРї СЃС‚СЂР°С…РѕРІР°РЅРёСЏ*</label>
          <select
            value={insuranceTypeId}
            onChange={(e) => setInsuranceTypeId(e.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Р’С‹Р±РµСЂРёС‚Рµ С‚РёРї СЃС‚СЂР°С…РѕРІР°РЅРёСЏ</option>
            {types.map((insuranceType) => (
              <option key={insuranceType.id} value={insuranceType.id}>
                {insuranceType.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">РљРѕРЅС‚СЂР°РіРµРЅС‚</label>
          <input
            type="text"
            value={counterparty}
            onChange={(event) => setCounterparty(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="РљРѕРјРїР°РЅРёСЏ / С„РёР·Р»РёС†Рѕ"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">РЎС‚СЂР°С…СѓРµС‚СЃСЏ Р°РІС‚РѕРјРѕР±РёР»СЊ</label>
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
            <span className="text-sm font-medium text-slate-700">Р”Р°</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Р”Р°С‚Р° РЅР°С‡Р°Р»Р°</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ</label>
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
            <label className="block text-sm font-medium text-slate-700">РњР°СЂРєР°</label>
            <input
              type="text"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              placeholder="Toyota"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">РњРѕРґРµР»СЊ</label>
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
              placeholder="РќРѕРјРµСЂ С€Р°СЃСЃРё (17 СЃРёРјРІРѕР»РѕРІ)"
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">РџР»Р°С‚РµР¶Рё</h3>
          <button
            type="button"
            onClick={handleAddPayment}
            className="text-sm font-medium text-sky-600 hover:text-sky-800"
          >
            + Р”РѕР±Р°РІРёС‚СЊ РїР»Р°С‚РµР¶
          </button>
        </div>

        {payments.length === 0 && (
          <p className="text-xs text-slate-500">Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РїР»Р°С‚РµР¶ РґР»СЏ СЂР°СЃС‡РµС‚Р° С„РёРЅР°РЅСЃРѕРІ</p>
        )}

        <div className="space-y-4">
          {payments.map((payment, paymentIndex) => (
            <div key={paymentIndex} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900">РџР»Р°С‚РµР¶ #{paymentIndex + 1}</span>
                <button
                  type="button"
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => handleRemovePayment(paymentIndex)}
                >
                  РЈРґР°Р»РёС‚СЊ РїР»Р°С‚РµР¶
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">РЎСѓРјРјР°, в‚Ѕ</label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) => updatePaymentField(paymentIndex, 'amount', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">РЎС‚Р°С‚СѓСЃ</label>
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
                  <label className="block text-xs font-medium text-slate-600">Р”Р°С‚Р° РїР»Р°РЅРѕРІР°СЏ</label>
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
                  <label className="block text-xs font-medium text-slate-600">Р”Р°С‚Р° С„Р°РєС‚РёС‡РµСЃРєР°СЏ</label>
                  <input
                    type="date"
                    value={payment.actualDate || ''}
                    onChange={(e) => updatePaymentField(paymentIndex, 'actualDate', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">РћРїРёСЃР°РЅРёРµ</label>
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
          РћС‚РјРµРЅР°
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'РЎРѕС…СЂР°РЅСЏРµРј...' : 'РЎРѕР·РґР°С‚СЊ РїРѕР»РёСЃ'}
        </button>
      </div>
    </form>
  );
};

