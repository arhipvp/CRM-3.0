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
import { PolicyBasicsStep } from './addPolicy/components/PolicyBasicsStep';
import { PolicyFinanceStep } from './addPolicy/components/PolicyFinanceStep';
import { PolicyPaymentsStep } from './addPolicy/components/PolicyPaymentsStep';
import { BTN_PRIMARY, BTN_SECONDARY } from '../common/buttonStyles';
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

const MAX_CLIENT_SUGGESTIONS = 5;
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
  const [note, setNote] = useState('');
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
  const [policyClientId, setPolicyClientId] = useState('');
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [
    createPaymentWithDefaultIncome(buildCommissionIncomeNote()),
  ]);
  const [expandedPaymentIndex, setExpandedPaymentIndex] = useState<number | null>(0);
  const [clientQuery, setClientQuery] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const filteredClients = useMemo(() => {
    const normalizedQuery = clientQuery.trim().toLowerCase();
    const candidates = normalizedQuery
      ? clients.filter((client) => client.name.toLowerCase().includes(normalizedQuery))
      : clients;
    return candidates.slice(0, MAX_CLIENT_SUGGESTIONS);
  }, [clients, clientQuery]);

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

  const resolveClientFromQuery = () => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) {
      return null;
    }
    return clients.find((client) => client.name.toLowerCase() === query) ?? null;
  };

  const handleClientSelect = (client: Client) => {
    setPolicyClientId(client.id);
    setClientQuery(client.name);
    setShowClientSuggestions(false);
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
      setNote('');
      setCounterpartyTouched(false);
      setSalesChannelId('');
      setStartDate('');
      setEndDate('');
      setHasManualEndDate(false);
      setPayments([createPaymentWithDefaultIncome(buildCommissionIncomeNote())]);
      setCurrentStep(1);
      setPolicyClientId('');
      setClientQuery('');
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
    setNote(initialValues.note || '');
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
    setPolicyClientId(initialValues.clientId || '');
    setClientQuery(initialValues.clientName ?? '');
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
      const resolvedClient = resolveClientFromQuery();
      const selectedClientId = resolvedClient?.id || policyClientId;
      const selectedClientName =
        resolvedClient?.name ||
        (selectedClientId
          ? clients.find((client) => client.id === selectedClientId)?.name
          : undefined) ||
        clientQuery.trim() ||
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
        note: note.trim() || undefined,
        salesChannelId: salesChannelId || undefined,
        clientId: selectedClientId || undefined,
        clientName: selectedClientName,
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
          <PolicyBasicsStep
            number={number}
            onNumberChange={setNumber}
            insuranceCompanyId={insuranceCompanyId}
            onInsuranceCompanyChange={setInsuranceCompanyId}
            loadingOptions={loadingOptions}
            companies={companies}
            insuranceTypeId={insuranceTypeId}
            onInsuranceTypeChange={setInsuranceTypeId}
            types={types}
            salesChannelId={salesChannelId}
            onSalesChannelChange={setSalesChannelId}
            salesChannels={salesChannels}
            clientQuery={clientQuery}
            onClientQueryChange={(value) => {
              setClientQuery(value);
              setShowClientSuggestions(true);
              setPolicyClientId('');
            }}
            onClientQueryFocus={() => setShowClientSuggestions(true)}
            onClientQueryBlur={() => {
              setTimeout(() => setShowClientSuggestions(false), 120);
            }}
            showClientSuggestions={showClientSuggestions}
            filteredClients={filteredClients}
            onClientSelect={handleClientSelect}
            onRequestAddClient={onRequestAddClient}
            isVehicle={isVehicle}
            onIsVehicleChange={(checked) => {
              if (!checked) {
                setBrand('');
                setModel('');
                setVin('');
              }
              setIsVehicle(checked);
            }}
            brand={brand}
            onBrandChange={(value) => {
              setBrand(value);
              setModel('');
            }}
            model={model}
            onModelChange={setModel}
            vin={vin}
            onVinChange={setVin}
            vehicleBrands={vehicleBrands}
            vehicleModels={vehicleModels}
          />
          <div className="space-y-2">
            <label className="app-label" htmlFor="policy-note-input">
              Примечание к полису
            </label>
            <textarea
              id="policy-note-input"
              rows={4}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Комментарий, особенности, важные договоренности..."
              className="field field-textarea min-h-28"
            />
            <p className="text-xs text-slate-500">{note.length}/2000</p>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <PolicyPaymentsStep
          startDate={startDate}
          onStartDateChange={handleStartDateChange}
          endDate={endDate}
          onEndDateChange={handleEndDateChange}
          policyDurationWarning={policyDurationWarning}
          payments={payments}
          onAddPayment={handleAddPayment}
          firstPaymentDateWarning={firstPaymentDateWarning}
          onPaymentFieldChange={updatePaymentField}
          onRemovePayment={handleRemovePayment}
          onAddRecord={addRecord}
          onUpdateRecord={updateRecordField}
          onRemoveRecord={removeRecord}
        />
      )}

      {currentStep === 3 && (
        <PolicyFinanceStep
          counterparty={counterparty}
          onCounterpartyChange={setCounterparty}
          onCounterpartyTouched={() => setCounterpartyTouched(true)}
          onAddCounterpartyExpenses={handleAddCounterpartyExpenses}
          executorName={executorName}
          onAddExecutorExpenses={handleAddExecutorExpenses}
          payments={payments}
          expandedPaymentIndex={expandedPaymentIndex}
          onTogglePaymentDetails={togglePaymentDetails}
          onExpandPaymentDetails={setExpandedPaymentIndex}
          onAddRecord={addRecord}
          onUpdateRecord={updateRecordField}
          onRemoveRecord={removeRecord}
        />
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button type="button" onClick={onCancel} className={BTN_SECONDARY} disabled={isSubmitting}>
          Отмена
        </button>
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePreviousStep}
              className={BTN_SECONDARY}
              disabled={isSubmitting}
            >
              Назад
            </button>
          )}
          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={handleNextStep}
              className={BTN_PRIMARY}
              disabled={isSubmitting}
            >
              Далее
            </button>
          ) : (
            <button
              type="submit"
              onMouseDown={markFinalSubmitIntent}
              onClick={markFinalSubmitIntent}
              className={BTN_PRIMARY}
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
