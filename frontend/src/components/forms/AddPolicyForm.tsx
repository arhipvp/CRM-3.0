import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';

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
import { formatCurrency, formatDate } from '../views/dealsView/helpers';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import {
  buildCommissionIncomeNote,
  resolveSalesChannelName,
  shouldAutofillCommissionNote,
} from '../../utils/financialRecordNotes';

interface AddPolicyFormProps {
  onSubmit: (values: PolicyFormValues) => Promise<void>;
  onCancel: () => void;
  salesChannels: SalesChannel[];
  initialValues?: PolicyFormValues;
  isEditing?: boolean;
  initialInsuranceCompanyName?: string;
  initialInsuranceTypeName?: string;
  defaultCounterparty?: string;
  executorName?: string | null;
  clients: Client[];
  onRequestAddClient: () => void;
}

const MAX_INSURED_SUGGESTIONS = 5;
const VIN_REGEX = /^[A-Za-z0-9]{17}$/;
const normalizeTypeForComparison = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim();

export const AddPolicyForm: React.FC<AddPolicyFormProps> = ({
  onSubmit,
  onCancel,
  salesChannels,
  initialValues,
  isEditing = false,
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
  const salesChannelName = useMemo(
    () => resolveSalesChannelName(salesChannels, salesChannelId),
    [salesChannels, salesChannelId],
  );
  const commissionNote = useMemo(
    () => buildCommissionIncomeNote(salesChannelName),
    [salesChannelName],
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [insuredClientId, setInsuredClientId] = useState('');
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [
    createPaymentWithDefaultIncome(buildCommissionIncomeNote()),
  ]);
  const [expandedPaymentIndex, setExpandedPaymentIndex] = useState<number | null>(0);
  const [insuredQuery, setInsuredQuery] = useState('');
  const [showInsuredSuggestions, setShowInsuredSuggestions] = useState(false);
  const filteredInsuredClients = useMemo(() => {
    const normalizedQuery = insuredQuery.trim().toLowerCase();
    const candidates = normalizedQuery
      ? clients.filter((client) => client.name.toLowerCase().includes(normalizedQuery))
      : clients;
    return candidates.slice(0, MAX_INSURED_SUGGESTIONS);
  }, [clients, insuredQuery]);

  useEffect(() => {
    setPayments((prev) =>
      prev.map((payment) => ({
        ...payment,
        incomes: payment.incomes.map((income) =>
          shouldAutofillCommissionNote(income.note) ? { ...income, note: commissionNote } : income,
        ),
      })),
    );
  }, [commissionNote]);

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
  const hasAutoExpenseRef = useRef(false);
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
        setOptionsError(
          'Не удалось загрузить справочники страховых компаний и типов. Обновите страницу и попробуйте снова.',
        );
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
    hasAutoExpenseRef.current = false;
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
      setPayments([createPaymentWithDefaultIncome(buildCommissionIncomeNote())]);
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
      })),
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
    setExpandedPaymentIndex((prev) => {
      if (!payments.length) {
        return null;
      }
      if (prev == null || prev >= payments.length) {
        return 0;
      }
      return prev;
    });
  }, [payments.length]);

  useEffect(() => {
    if (!initialInsuranceCompanyName || !companies.length) {
      return;
    }
    const match = companies.find(
      (company) => company.name.toLowerCase() === initialInsuranceCompanyName.toLowerCase(),
    );
    if (match) {
      setInsuranceCompanyId(match.id);
    }
  }, [initialInsuranceCompanyName, companies]);

  useEffect(() => {
    if (!initialInsuranceTypeName || !types.length) {
      return;
    }
    const normalizedRecognized = normalizeTypeForComparison(initialInsuranceTypeName);
    if (!normalizedRecognized) {
      return;
    }
    const match = types.find(
      (type) => normalizeTypeForComparison(type.name) === normalizedRecognized,
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
        setOptionsError(
          'Не удалось загрузить справочники марок и моделей. Попробуйте обновить страницу.',
        );
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
        setOptionsError(
          'Не удалось загрузить справочники марок и моделей. Попробуйте обновить страницу.',
        );
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
    startDate && payments[0] && payments[0].scheduledDate && payments[0].scheduledDate !== startDate
      ? 'Дата первого платежа не совпадает с началом полиса. Проверьте расписание.'
      : null;

  const appendExpenseToAllPayments = useCallback((note: string) => {
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      return;
    }

    setPayments((prev) =>
      prev.map((payment) => {
        const alreadyHasNote = payment.expenses.some(
          (expense) => (expense.note ?? '').trim() === normalizedNote,
        );
        if (alreadyHasNote) {
          return payment;
        }
        return {
          ...payment,
          expenses: [...payment.expenses, { ...createEmptyRecord('1'), note: normalizedNote }],
        };
      }),
    );
  }, []);

  useEffect(() => {
    if (isEditing || hasAutoExpenseRef.current) {
      return;
    }
    const counterpartyName = counterparty.trim();
    const executor = executorName?.trim();
    const note = counterpartyName
      ? `Расход контрагенту ${counterpartyName}`
      : executor
        ? `Расход исполнителю ${executor}`
        : '';
    if (!note) {
      return;
    }
    const hasAnyExpense = payments.some((payment) => payment.expenses.length > 0);
    if (hasAnyExpense) {
      hasAutoExpenseRef.current = true;
      return;
    }
    appendExpenseToAllPayments(note);
    hasAutoExpenseRef.current = true;
  }, [appendExpenseToAllPayments, counterparty, executorName, initialValues, isEditing, payments]);

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
    setPayments((prev) => [...prev, createPaymentWithDefaultIncome(commissionNote)]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const togglePaymentDetails = (index: number) => {
    setExpandedPaymentIndex((prev) => (prev === index ? null : index));
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
    value: string,
  ) => {
    setPayments((prev) =>
      prev.map((payment, idx) =>
        idx === index
          ? {
              ...payment,
              [field]: value,
            }
          : payment,
      ),
    );
  };

  const addRecord = (paymentIndex: number, type: 'incomes' | 'expenses') => {
    setPayments((prev) =>
      prev.map((payment, idx) =>
        idx === paymentIndex
          ? {
              ...payment,
              [type]: [
                ...payment[type],
                type === 'expenses'
                  ? createEmptyRecord('1')
                  : createEmptyRecord('0', commissionNote),
              ],
            }
          : payment,
      ),
    );
  };

  const updateRecordField = (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
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
            : record,
        );
        return {
          ...payment,
          [type]: updatedRecords,
        };
      }),
    );
  };

  const removeRecord = (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
  ) => {
    setPayments((prev) =>
      prev.map((payment, idx) =>
        idx === paymentIndex
          ? {
              ...payment,
              [type]: payment[type].filter((_, recIdx) => recIdx !== recordIndex),
            }
          : payment,
      ),
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

    const normalizedVin = vin.trim();

    if (isVehicle && !normalizedVin) {
      setError('Укажите VIN, если полис оформлен на автомобиль.');
      return;
    }

    if (normalizedVin && !VIN_REGEX.test(normalizedVin)) {
      setError('VIN должен состоять из 17 латинских букв и цифр.');
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
        insuredQuery.trim() ||
        undefined;

      await onSubmit({
        number: number.trim(),
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand: isVehicle ? brand.trim() || undefined : undefined,
        model: isVehicle ? model.trim() || undefined : undefined,
        vin: isVehicle ? normalizedVin : undefined,
        counterparty: counterparty.trim() || undefined,
        salesChannelId: salesChannelId || undefined,
        insuredClientId: selectedInsuredId || undefined,
        insuredClientName: selectedInsuredName,
        startDate: startDate || null,
        endDate: endDate || null,
        payments,
      });
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось сохранить полис. Попробуйте позже.'));
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
      {(error || optionsError) && (
        <p className="app-alert app-alert-danger">{error || optionsError}</p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, stepIndex) => (
            <button
              key={step.title}
              type="button"
              onClick={() => setCurrentStep(stepIndex + 1)}
              className={`btn btn-sm ${currentStep === stepIndex + 1 ? 'btn-primary' : 'btn-secondary'}`}
            >
              {step.title}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-600">{steps[currentStep - 1].description}</p>
      </div>

      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="app-label">Номер полиса *</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="field field-input mt-2"
                placeholder="001234567890"
              />
            </div>
            <div>
              <label className="app-label">Страховая компания *</label>
              <select
                value={insuranceCompanyId}
                onChange={(e) => setInsuranceCompanyId(e.target.value)}
                disabled={loadingOptions}
                className="field field-input mt-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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
              <label className="app-label">Тип страхования *</label>
              <select
                value={insuranceTypeId}
                onChange={(e) => setInsuranceTypeId(e.target.value)}
                disabled={loadingOptions}
                className="field field-input mt-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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
              <label className="app-label">Канал продаж</label>
              <select
                value={salesChannelId}
                onChange={(event) => setSalesChannelId(event.target.value)}
                disabled={loadingOptions}
                className="field field-input mt-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
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
            <label className="app-label">Страхователь</label>
            <div className="mt-2 flex flex-col gap-2 relative">
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
                    className="field field-input"
                    placeholder="Начните вводить клиента"
                  />
                  {showInsuredSuggestions && (
                    <div className="absolute inset-x-0 top-full z-10 mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {filteredInsuredClients.length ? (
                        filteredInsuredClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
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
                  className="btn btn-sm btn-secondary whitespace-nowrap"
                >
                  + Добавить клиента
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="app-label">Привязать к транспорту</label>
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
                  className="check"
                />
                <span className="text-sm font-semibold text-slate-700">Да</span>
              </label>
            </div>
          </div>

          {isVehicle && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="app-label">Марка</label>
                <input
                  list="vehicle-brand-options"
                  type="text"
                  value={brand}
                  onChange={(event) => {
                    setBrand(event.target.value);
                    setModel('');
                  }}
                  className="field field-input mt-2"
                  placeholder="Toyota"
                />
                <datalist id="vehicle-brand-options">
                  {vehicleBrands.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="app-label">Модель</label>
                <input
                  list="vehicle-model-options"
                  type="text"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="field field-input mt-2"
                  placeholder="Camry"
                />
                <datalist id="vehicle-model-options">
                  {vehicleModels.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="app-label">VIN</label>
                <input
                  type="text"
                  value={vin}
                  onChange={(event) => setVin(event.target.value)}
                  maxLength={17}
                  className="field field-input mt-2"
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
              <label className="app-label">Дата начала</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="field field-input mt-2"
              />
            </div>
            <div>
              <label className="app-label">Дата окончания</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="field field-input mt-2"
              />
            </div>
          </div>

          {policyDurationWarning && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {policyDurationWarning}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="app-label">Платежи</p>
              <button type="button" onClick={handleAddPayment} className="btn btn-sm btn-secondary">
                + Добавить платёж
              </button>
            </div>
            {firstPaymentDateWarning && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {firstPaymentDateWarning}
              </p>
            )}
            {payments.length === 0 && (
              <p className="text-sm text-slate-600">
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
              <label className="app-label">Контрагент</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={counterparty}
                  onChange={(event) => {
                    setCounterparty(event.target.value);
                    setCounterpartyTouched(true);
                  }}
                  className="field field-input flex-1"
                  placeholder="Контрагент / организация"
                />
                <button
                  type="button"
                  onClick={handleAddCounterpartyExpenses}
                  className="btn btn-sm btn-secondary whitespace-nowrap"
                >
                  + Расход
                </button>
              </div>
            </div>
            <div>
              <label className="app-label">Исполнитель по сделке</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={executorName ?? 'отсутствует'}
                  readOnly
                  className="field field-input flex-1 bg-slate-50 text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddExecutorExpenses}
                  disabled={!executorName?.trim()}
                  className="btn btn-sm btn-secondary whitespace-nowrap"
                >
                  + Расход
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {payments.map((payment, paymentIndex) => {
              const isExpanded = expandedPaymentIndex === paymentIndex;
              return (
                <section
                  key={`records-${paymentIndex}`}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {payment.description || `Платёж #${paymentIndex + 1}`}
                      </p>
                      <p className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Сумма {formatCurrency(payment.amount || '0')}</span>
                        <span>План {formatDate(payment.scheduledDate)}</span>
                        <span className={payment.actualDate ? 'text-emerald-600' : 'text-rose-600'}>
                          Оплачен {payment.actualDate ? formatDate(payment.actualDate) : 'не оплачен'}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          addRecord(paymentIndex, 'incomes');
                          setExpandedPaymentIndex(paymentIndex);
                        }}
                        className="btn btn-sm btn-secondary"
                      >
                        + Доход
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addRecord(paymentIndex, 'expenses');
                          setExpandedPaymentIndex(paymentIndex);
                        }}
                        className="btn btn-sm btn-secondary"
                      >
                        + Расход
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePaymentDetails(paymentIndex)}
                        className="btn btn-sm btn-secondary whitespace-nowrap"
                      >
                        {isExpanded ? 'Свернуть' : 'Развернуть'}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                      <div className="app-panel-muted p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Доходы
                          </h4>
                          <button
                            type="button"
                            className="btn btn-sm btn-quiet"
                            onClick={() => addRecord(paymentIndex, 'incomes')}
                          >
                            + Добавить доход
                          </button>
                        </div>
                        {payment.incomes.length === 0 && (
                          <p className="text-sm text-slate-600">
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
                      <div className="app-panel-muted p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Расходы
                          </h4>
                          <button
                            type="button"
                            className="btn btn-sm btn-quiet"
                            onClick={() => addRecord(paymentIndex, 'expenses')}
                          >
                            + Добавить расход
                          </button>
                        </div>
                        {payment.expenses.length === 0 && (
                          <p className="text-sm text-slate-600">
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
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={isSubmitting}
        >
          Отмена
        </button>
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePreviousStep}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Назад
            </button>
          )}
          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              Далее
            </button>
          ) : (
            <button
              type="submit"
              onMouseDown={markFinalSubmitIntent}
              onClick={markFinalSubmitIntent}
              className="btn btn-primary"
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
