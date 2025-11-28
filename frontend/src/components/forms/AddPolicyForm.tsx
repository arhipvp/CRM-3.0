import React, { useEffect, useState } from 'react';

import {
  fetchInsuranceCompanies,
  fetchInsuranceTypes,
  fetchVehicleBrands,
  fetchVehicleModels,
} from '../../api';
import type { InsuranceCompany, InsuranceType, SalesChannel } from '../../types';
import type { FinancialRecordDraft } from './addPolicy/types';
import {
  createEmptyRecord,
  createPaymentWithDefaultIncome,
  PaymentDraft,
  PolicyFormValues,
} from './addPolicy/types';
import { PaymentSection } from './addPolicy/components/PaymentSection';

interface AddPolicyFormProps {
  onSubmit: (values: PolicyFormValues) => Promise<void>;
  onCancel: () => void;
  salesChannels: SalesChannel[];
  initialValues?: PolicyFormValues;
  initialInsuranceCompanyName?: string;
  initialInsuranceTypeName?: string;
  defaultCounterparty?: string;
}

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({
  onSubmit,
  onCancel,
  salesChannels,
  initialValues,
  initialInsuranceCompanyName,
  initialInsuranceTypeName,
  defaultCounterparty,
}) => {
  const [number, setNumber] = useState('');
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [insuranceTypeId, setInsuranceTypeId] = useState('');
  const [isVehicle, setIsVehicle] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vin, setVin] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [counterpartyTouched, setCounterpartyTouched] = useState(false);
  const [salesChannelId, setSalesChannelId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [createPaymentWithDefaultIncome()]);
  const [hasManualEndDate, setHasManualEndDate] = useState(false);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [vehicleBrands, setVehicleBrands] = useState<string[]>([]);
  const [vehicleModels, setVehicleModels] = useState<string[]>([]);
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
      setCounterpartyTouched(false);
      setSalesChannelId('');
      setStartDate('');
      setEndDate('');
      setHasManualEndDate(false);
      setPayments([createPaymentWithDefaultIncome()]);
      return;
    }
    setNumber(initialValues.number || '');
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
    setHasManualEndDate(!!initialValues.endDate);
    const initialPayments = initialValues.payments || [];
    setPayments(
      initialPayments.map((payment) => ({
        ...payment,
        incomes: payment.incomes ?? [],
        expenses: payment.expenses ?? [],
      }))
    );
    setCounterpartyTouched(Boolean(initialValues.counterparty));
  }, [initialValues]);

  useEffect(() => {
    if (initialValues) {
      return;
    }
    if (!defaultCounterparty || counterpartyTouched) {
      return;
    }
    setCounterparty(defaultCounterparty);
  }, [defaultCounterparty, counterpartyTouched, initialValues]);

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

  useEffect(() => {
    let isMounted = true;
    fetchVehicleBrands()
      .then((brands) => {
        if (!isMounted) return;
        setVehicleBrands(brands);
      })
      .catch(() => {
        if (!isMounted) return;
        setOptionsError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїСЂР°РІРѕС‡РЅРёРєРё РјР°СЂРѕРє Рё РјРѕРґРµР»РµР№');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchVehicleModels(brand || undefined)
      .then((models) => {
        if (!isMounted) return;
        setVehicleModels(models);
      })
      .catch(() => {
        if (!isMounted) return;
        setOptionsError('РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїСЂР°РІРѕС‡РЅРёРєРё РјР°СЂРѕРє Рё РјРѕРґРµР»РµР№');
      });
    return () => {
      isMounted = false;
    };
  }, [brand]);

  const getDefaultEndDate = (value: string) => {
    if (!value) {
      return '';
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }
    const nextDate = new Date(parsedDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    nextDate.setDate(nextDate.getDate() - 1);
    return nextDate.toISOString().split('T')[0];
  };

  const handleStartDateChange = (value: string) => {
    const previousStart = startDate;
    const previousScheduledDate = payments[0]?.scheduledDate ?? '';
    const shouldUpdateFirstPayment =
      !previousScheduledDate || previousScheduledDate === previousStart;

    setStartDate(value);

    if (payments.length && shouldUpdateFirstPayment) {
      setPayments((prev) => {
        if (!prev.length) {
          return prev;
        }
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          scheduledDate: value,
        };
        return updated;
      });
    }

    if (!value || hasManualEndDate) {
      return;
    }
    const defaultEnd = getDefaultEndDate(value);
    if (defaultEnd) {
      setEndDate(defaultEnd);
      setHasManualEndDate(false);
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setHasManualEndDate(Boolean(value));
  };

  const computedDefaultEndDate = startDate ? getDefaultEndDate(startDate) : '';
  const policyDurationWarning =
    startDate && endDate && computedDefaultEndDate && endDate !== computedDefaultEndDate
      ? 'РЎСЂРѕРє РїРѕР»РёСЃР° РѕР±С‹С‡РЅРѕ РґР»РёС‚СЃСЏ 1 РіРѕРґ РјРёРЅСѓСЃ 1 РґРµРЅСЊ вЂ” СѓС‚РѕС‡РЅРёС‚Рµ РґР°С‚Сѓ РѕРєРѕРЅС‡Р°РЅРёСЏ.'
      : null;
  const firstPaymentDateWarning =
    startDate &&
    payments[0] &&
    payments[0].scheduledDate &&
    payments[0].scheduledDate !== startDate
      ? 'РџРµСЂРІС‹Р№ РїР»Р°С‚С‘Р¶ РѕР±С‹С‡РЅРѕ РЅР°Р·РЅР°С‡Р°РµС‚СЃСЏ РЅР° РґРµРЅСЊ РЅР°С‡Р°Р»Р° РїРѕР»РёСЃР° вЂ” РїСЂРѕРІРµСЂСЊС‚Рµ СЂР°СЃРїРёСЃР°РЅРёРµ.'
      : null;

  const handleCounterpartyBlur = () => {
    const trimmed = counterparty.trim();
    if (!trimmed) {
      return;
    }

    setPayments((prev) => {
      if (prev.length === 0) {
        return [
          {
            ...createPaymentWithDefaultIncome(),
            expenses: [{ ...createEmptyRecord(), description: trimmed }],
          },
        ];
      }

      const firstPayment = prev[0];
      const alreadyHasExpense = firstPayment.expenses.some(
        (expense) =>
          (expense.description || '').trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (alreadyHasExpense) {
        return prev;
      }

      return [
        {
          ...firstPayment,
          expenses: [
            ...firstPayment.expenses,
            { ...createEmptyRecord(), description: trimmed },
          ],
        },
        ...prev.slice(1),
      ];
    });
  };

  const handleAddPayment = () => {
    setPayments((prev) => [...prev, createPaymentWithDefaultIncome()]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
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
        salesChannelId: salesChannelId || undefined,
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <label className="block text-sm font-medium text-slate-700">Контрагент</label>
          <input
            type="text"
            value={counterparty}
            onChange={(event) => {
              setCounterparty(event.target.value);
              setCounterpartyTouched(true);
            }}
            onBlur={handleCounterpartyBlur}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            placeholder="Компания / физлицо"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">РљР°РЅР°Р» РїСЂРѕРґР°Р¶</label>
          <select
            value={salesChannelId}
            onChange={(event) => setSalesChannelId(event.target.value)}
            disabled={loadingOptions}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="">Р’С‹Р±РµСЂРёС‚Рµ РєР°РЅР°Р» РїСЂРѕРґР°Р¶</option>
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
            onChange={(e) => handleStartDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ</label>
            <input
              type="date"
              value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {policyDurationWarning && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          {policyDurationWarning}
        </p>
      )}

      {isVehicle && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Марка</label>
            <input
              list="vehicle-brand-options"
              type="text"
              value={brand}
              onChange={(event) => {
                setBrand(event.target.value);
                setModel('');
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              placeholder="Toyota"
            />
            <datalist id="vehicle-brand-options">
              {vehicleBrands.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Модель</label>
            <input
              list="vehicle-model-options"
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              placeholder="Camry"
            />
            <datalist id="vehicle-model-options">
              {vehicleModels.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
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

        {firstPaymentDateWarning && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            {firstPaymentDateWarning}
          </p>
        )}
        {payments.length === 0 && (
          <p className="text-xs text-slate-500">Р”РѕР±Р°РІСЊС‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РїР»Р°С‚РµР¶ РґР»СЏ СЂР°СЃС‡РµС‚Р° С„РёРЅР°РЅСЃРѕРІ</p>
        )}

        <div className="space-y-4">
          {payments.map((payment, paymentIndex) => (
            <PaymentSection
              key={paymentIndex}
              paymentIndex={paymentIndex}
              payment={payment}
              onFieldChange={updatePaymentField}
              onRemovePayment={handleRemovePayment}
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
