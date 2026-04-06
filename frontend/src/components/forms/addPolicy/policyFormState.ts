import {
  createEmptyRecord,
  createPaymentWithDefaultIncome,
  type FinancialRecordDraft,
  type PaymentDraft,
  type PolicyFormValues,
} from './types';
import { buildCommissionIncomeNote } from '../../../utils/financialRecordNotes';

interface PolicyFormSnapshotInput {
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  isVehicle: boolean;
  brand: string;
  model: string;
  vin: string;
  counterparty: string;
  note: string;
  salesChannelId: string;
  startDate: string;
  endDate: string;
  policyClientId: string;
  clientQuery: string;
  payments: PaymentDraft[];
}

const normalizeRecord = (record: FinancialRecordDraft) => ({
  id: record.id ?? '',
  amount: record.amount ?? '',
  date: record.date ?? '',
  description: record.description ?? '',
  source: record.source ?? '',
  note: record.note ?? '',
});

const normalizePayment = (payment: PaymentDraft) => ({
  id: payment.id ?? '',
  amount: payment.amount ?? '',
  description: payment.description ?? '',
  scheduledDate: payment.scheduledDate ?? '',
  actualDate: payment.actualDate ?? '',
  incomes: (payment.incomes ?? []).map(normalizeRecord),
  expenses: (payment.expenses ?? []).map(normalizeRecord),
});

export const buildPolicyFormSnapshot = (input: PolicyFormSnapshotInput) =>
  JSON.stringify({
    number: input.number,
    insuranceCompanyId: input.insuranceCompanyId,
    insuranceTypeId: input.insuranceTypeId,
    isVehicle: input.isVehicle,
    brand: input.brand,
    model: input.model,
    vin: input.vin,
    counterparty: input.counterparty,
    note: input.note,
    salesChannelId: input.salesChannelId,
    startDate: input.startDate,
    endDate: input.endDate,
    policyClientId: input.policyClientId,
    clientQuery: input.clientQuery,
    payments: input.payments.map(normalizePayment),
  });

const buildDefaultPaymentExpenses = (
  defaultCounterparty?: string,
  executorName?: string | null,
): FinancialRecordDraft[] => {
  const counterpartyName = defaultCounterparty?.trim();
  const executor = executorName?.trim();

  if (counterpartyName) {
    return [{ ...createEmptyRecord('1'), note: `Расход контрагенту ${counterpartyName}` }];
  }

  if (executor) {
    return [{ ...createEmptyRecord('1'), note: `Расход исполнителю ${executor}` }];
  }

  return [];
};

const normalizeInitialPayments = (payments: PaymentDraft[]) =>
  payments.map((payment) => ({
    ...payment,
    incomes: payment.incomes ?? [],
    expenses: payment.expenses ?? [],
  }));

export const buildInitialPolicyFormSnapshot = ({
  initialValues,
  defaultCounterparty,
  executorName,
}: {
  initialValues?: PolicyFormValues;
  defaultCounterparty?: string;
  executorName?: string | null;
}) => {
  if (initialValues) {
    return buildPolicyFormSnapshot({
      number: initialValues.number ?? '',
      insuranceCompanyId: initialValues.insuranceCompanyId ?? '',
      insuranceTypeId: initialValues.insuranceTypeId ?? '',
      isVehicle: initialValues.isVehicle,
      brand: initialValues.brand ?? '',
      model: initialValues.model ?? '',
      vin: initialValues.vin ?? '',
      counterparty: initialValues.counterparty ?? '',
      note: initialValues.note ?? '',
      salesChannelId: initialValues.salesChannelId ?? '',
      startDate: initialValues.startDate ?? '',
      endDate: initialValues.endDate ?? '',
      policyClientId: initialValues.clientId ?? '',
      clientQuery: initialValues.clientName ?? '',
      payments: normalizeInitialPayments(initialValues.payments ?? []),
    });
  }

  const defaultPayment = createPaymentWithDefaultIncome(buildCommissionIncomeNote());
  defaultPayment.expenses = buildDefaultPaymentExpenses(defaultCounterparty, executorName);

  return buildPolicyFormSnapshot({
    number: '',
    insuranceCompanyId: '',
    insuranceTypeId: '',
    isVehicle: false,
    brand: '',
    model: '',
    vin: '',
    counterparty: defaultCounterparty ?? '',
    note: '',
    salesChannelId: '',
    startDate: '',
    endDate: '',
    policyClientId: '',
    clientQuery: '',
    payments: [defaultPayment],
  });
};
