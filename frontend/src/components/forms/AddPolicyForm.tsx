import React, { useEffect, useRef, useState, useMemo } from 'react';

import {
  fetchInsuranceCompanies,
  fetchInsuranceTypes,
  fetchVehicleBrands,
  fetchVehicleModels,
} from '../../api';
import type { Client, InsuranceCompany, InsuranceType, SalesChannel } from '../../types';
import type { FinancialRecordDraft } from './addPolicy/types';
import {
  createEmptyRecord,
  createPaymentWithDefaultIncome,
  PaymentDraft,
  PolicyFormValues,
} from './addPolicy/types';
import { FinancialRecordInputs } from './addPolicy/components/FinancialRecordInputs';
import { PaymentSection } from './addPolicy/components/PaymentSection';

interface AddPolicyFormProps {
  onSubmit: (values: PolicyFormValues) => Promise<void>;
  onCancel: () => void;
  salesChannels: SalesChannel[];
  initialValues?: PolicyFormValues;
  initialInsuranceCompanyName?: string;
  initialInsuranceTypeName?: string;
  defaultCounterparty?: string;
  executorName?: string | null;
  clients: Client[];
  onRequestAddClient: () => void;
}

const MAX_INSURED_SUGGESTIONS = 5;

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({
  onSubmit,
  onCancel,
  salesChannels,
  initialValues,
  initialInsuranceCompanyName,
  initialInsuranceTypeName,
  defaultCounterparty,
  executorName,
  clients,
  onRequestAddClient,
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
  const [insuredClientId, setInsuredClientId] = useState('');
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [createPaymentWithDefaultIncome()]);
  const [insuredQuery, setInsuredQuery] = useState('');
  const [showInsuredSuggestions, setShowInsuredSuggestions] = useState(false);
  const filteredInsuredClients = useMemo(() => {
    const normalizedQuery = insuredQuery.trim().toLowerCase();
    const candidates = normalizedQuery
      ? clients.filter((client) =>
          client.name.toLowerCase().includes(normalizedQuery)
        )
      : clients;
    return candidates.slice(0, MAX_INSURED_SUGGESTIONS);
  }, [clients, insuredQuery]);

  const resolveInsuredFromQuery = () => {
    const query = insuredQuery.trim().toLowerCase();
    if (!query) {
      return null;
    }
    return clients.find((client) => client.name.toLowerCase() === query) ?? null;
  };

  const handleInsuredSelect = (client: Client) => {
    setInsuredClientId(client.id);
    setInsuredQuery(client.name);
    setShowInsuredSuggestions(false);
  };
  const [hasManualEndDate, setHasManualEndDate] = useState(false);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [types, setTypes] = useState<InsuranceType[]>([]);
  const [vehicleBrands, setVehicleBrands] = useState<string[]>([]);
  const [vehicleModels, setVehicleModels] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const submitLabel = initialValues ? 'Сохранить полис' : 'Создать полис';
  const steps = [
    { title: 'Полис', description: 'Номер, страховая и тип' },
    { title: 'Платежи и сроки', description: 'График и даты действия' },
    { title: 'Контрагенты и финансы', description: 'Доходы, расходы и партнёры' },
  ];
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = steps.length;

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
        setOptionsError('Не удалось загрузить справочники страховых компаний и типов. Обновите страницу и попробуйте снова.');
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
      setCurrentStep(1);
      setInsuredClientId('');
      setInsuredQuery('');
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
    setInsuredClientId(initialValues.insuredClientId || '');
    setInsuredQuery(initialValues.insuredClientName ?? '');
    setCurrentStep(1);
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
        setOptionsError('Не удалось загрузить справочники марок и моделей. Попробуйте обновить страницу.');
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
        setOptionsError('Не удалось загрузить справочники марок и моделей. Попробуйте обновить страницу.');
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
      ? 'Срок полиса отличается от стандартного годового периода. Уточните даты, если это ожидаемо.'
      : null;
  const firstPaymentDateWarning =
    startDate &&
    payments[0] &&
    payments[0].scheduledDate &&
    payments[0].scheduledDate !== startDate
      ? 'Дата первого платежа не совпадает с началом полиса. Проверьте расписание.'
      : null;

  const appendExpenseToAllPayments = (note: string) => {
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      return;
    }

    setPayments((prev) =>
      prev.map((payment) => {
        const alreadyHasNote = payment.expenses.some(
          (expense) => (expense.note ?? '').trim() === normalizedNote
        );
        if (alreadyHasNote) {
          return payment;
        }
        return {
          ...payment,
          expenses: [...payment.expenses, { ...createEmptyRecord(), note: normalizedNote }],
        };
      })
    );
  };

  const handleAddCounterpartyExpenses = () => {
    const name = counterparty.trim();
    if (!name) {
      return;
    }
    appendExpenseToAllPayments(`Расход контрагенту ${name}`);
  };

  const handleAddExecutorExpenses = () => {
    const name = executorName?.trim();
    if (!name) {
      return;
    }
    appendExpenseToAllPayments(`Расход исполнителю ${name}`);
  };

  const handleAddPayment = () => {
    setPayments((prev) => [...prev, createPaymentWithDefaultIncome()]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!number.trim() || !insuranceCompanyId || !insuranceTypeId) {
        setError('Заполните номер полиса, страховую компанию и тип страхования.');
        return;
      }
    }
    if (currentStep === 2) {
      if (!payments.length) {
        setError('Добавьте хотя бы один платёж, чтобы связать финансовые данные.');
        return;
      }
    }
    setError(null);
    setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const handlePreviousStep = () => {
    setError(null);
    finalSubmitIntent.current = false;
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const finalSubmitIntent = useRef(false);

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || currentStep !== totalSteps) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target instanceof HTMLButtonElement) {
      return;
    }
    event.preventDefault();
  };

  const markFinalSubmitIntent = () => {
    finalSubmitIntent.current = true;
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
    if (currentStep < totalSteps) {
      finalSubmitIntent.current = false;
      handleNextStep();
      return;
    }
    if (!finalSubmitIntent.current) {
      return;
    }
    finalSubmitIntent.current = false;
    if (!number.trim() || !insuranceCompanyId || !insuranceTypeId) {
      setError('Заполните номер полиса, страховую компанию и тип страхования.');
      return;
    }

    if (isVehicle && !vin.trim()) {
      setError('Укажите VIN, если полис оформлен на автомобиль.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const resolvedInsured = resolveInsuredFromQuery();
      const selectedInsuredId = resolvedInsured?.id || insuredClientId;
      const selectedInsuredName =
        resolvedInsured?.name ||
        (selectedInsuredId
          ? clients.find((client) => client.id === selectedInsuredId)?.name
          : undefined) ||
        (insuredQuery.trim() || undefined);

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
        insuredClientId: selectedInsuredId || undefined,
        insuredClientName: selectedInsuredName,
        startDate: startDate || null,
        endDate: endDate || null,
        payments,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить полис. Попробуйте позже.');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4">
      {(error || optionsError) && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error || optionsError}</p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          {steps.map((step, stepIndex) => (
            <button
              key={step.title}
              type="button"
              onClick={() => setCurrentStep(stepIndex + 1)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                currentStep === stepIndex + 1
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {step.title}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{steps[currentStep - 1].description}</p>
      </div>

      {currentStep === 1 && (
        <div className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-slate-700">Страхователь</label>
            <div className="mt-1 flex flex-col gap-2 relative">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={insuredQuery}
                    onFocus={() => setShowInsuredSuggestions(true)}
                    onChange={(event) => {
                      setInsuredQuery(event.target.value);
                      setShowInsuredSuggestions(true);
                      setInsuredClientId('');
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowInsuredSuggestions(false), 120);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
                    placeholder="Начните вводить клиента"
                  />
                  {showInsuredSuggestions && (
                    <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {filteredInsuredClients.length ? (
                        filteredInsuredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleInsuredSelect(client);
                            }}
                          >
                            {client.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-slate-500">Клиенты не найдены</div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onRequestAddClient}
                  className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  + Добавить клиента
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Привязать к транспорту</label>
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
          </div>

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
                  placeholder="Номер шасси (17 символов)"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Дата начала</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Дата окончания</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
          </div>

          {policyDurationWarning && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              {policyDurationWarning}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Платежи</h3>
              <button
                type="button"
                onClick={handleAddPayment}
                className="text-sm font-medium text-sky-600 hover:text-sky-800"
              >
                + Добавить платёж
              </button>
            </div>
            {firstPaymentDateWarning && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                {firstPaymentDateWarning}
              </p>
            )}
            {payments.length === 0 && (
              <p className="text-xs text-slate-500">
                Добавьте хотя бы один платёж, чтобы связать финансовые данные.
              </p>
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
                  showRecords={false}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Контрагент</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={counterparty}
                  onChange={(event) => {
                    setCounterparty(event.target.value);
                    setCounterpartyTouched(true);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
                  placeholder="Контрагент / организация"
                />
                <button
                  type="button"
                  onClick={handleAddCounterpartyExpenses}
                  className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900"
                >
                  + Расход
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Исполнитель по сделке</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={executorName ?? 'отсутствует'}
                  readOnly
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAddExecutorExpenses}
                  disabled={!executorName?.trim()}
                  className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                >
                  + Расход
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {payments.map((payment, paymentIndex) => (
              <section key={`records-${paymentIndex}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Платёж #{paymentIndex + 1}</p>
                    <p className="text-xs text-slate-500">
                      Сумма {payment.amount || 'не указана'} · план {payment.scheduledDate || 'не указан'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => addRecord(paymentIndex, 'incomes')}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      + Доход
                    </button>
                    <button
                      type="button"
                      onClick={() => addRecord(paymentIndex, 'expenses')}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      + Расход
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Доходы</h4>
                      <button
                        type="button"
                        className="text-xs text-sky-600 hover:underline"
                        onClick={() => addRecord(paymentIndex, 'incomes')}
                      >
                        + Добавить доход
                      </button>
                    </div>
                    {payment.incomes.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Добавьте доход, чтобы привязать поступление к этому платежу.
                      </p>
                    )}
                    <FinancialRecordInputs
                      paymentIndex={paymentIndex}
                      type="incomes"
                      records={payment.incomes}
                      onUpdateRecord={updateRecordField}
                      onRemoveRecord={removeRecord}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Расходы</h4>
                      <button
                        type="button"
                        className="text-xs text-sky-600 hover:underline"
                        onClick={() => addRecord(paymentIndex, 'expenses')}
                      >
                        + Добавить расход
                      </button>
                    </div>
                    {payment.expenses.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Добавьте расход, чтобы контролировать связанные списания.
                      </p>
                    )}
                    <FinancialRecordInputs
                      paymentIndex={paymentIndex}
                      type="expenses"
                      records={payment.expenses}
                      onUpdateRecord={updateRecordField}
                      onRemoveRecord={removeRecord}
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          disabled={isSubmitting}
        >
          Отмена
        </button>
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePreviousStep}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              disabled={isSubmitting}
            >
              Назад
            </button>
          )}
          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              Далее
            </button>
          ) : (
            <button
              type="submit"
              onMouseDown={markFinalSubmitIntent}
              onClick={markFinalSubmitIntent}
              className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Сохраняем...' : submitLabel}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
