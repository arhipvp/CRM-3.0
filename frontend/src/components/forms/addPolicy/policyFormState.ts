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
  renewedById: string;
  renewsPolicyId: string;
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
    renewedById: input.renewedById,
    renewsPolicyId: input.renewsPolicyId,
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

export const buildDefaultPaymentExpenses = (
  defaultCounterparty?: string,
  executorName?: string | null,
): FinancialRecordDraft[] => {
  const counterpartyName = defaultCounterparty?.trim();
  const executor = executorName?.trim();
  const expenses: FinancialRecordDraft[] = [];

  if (counterpartyName) {
    expenses.push({
      ...createEmptyRecord('1'),
      note: `Расход контрагенту ${counterpartyName}`,
    });
  }

  if (executor) {
    expenses.push({
      ...createEmptyRecord('1'),
      note: `Расход исполнителю ${executor}`,
    });
  }

  return expenses;
};

export const normalizeCreateFormPayments = ({
  payments,
  defaultCounterparty,
  executorName,
}: {
  payments: PaymentDraft[];
  defaultCounterparty?: string;
  executorName?: string | null;
}) =>
  payments.map((payment) => ({
    ...payment,
    incomes: payment.incomes ?? [],
    expenses:
      payment.expenses && payment.expenses.length > 0
        ? payment.expenses
        : buildDefaultPaymentExpenses(defaultCounterparty, executorName),
  }));

export const buildInitialPolicyFormSnapshot = ({
  initialValues,
  isEditing,
  defaultCounterparty,
  executorName,
}: {
  initialValues?: PolicyFormValues;
  isEditing?: boolean;
  defaultCounterparty?: string;
  executorName?: string | null;
}) => {
  if (initialValues) {
    return buildPolicyFormSnapshot({
      number: initialValues.number ?? '',
      insuranceCompanyId: initialValues.insuranceCompanyId ?? '',
      insuranceTypeId: initialValues.insuranceTypeId ?? '',
      renewedById: initialValues.renewedById ?? '',
      renewsPolicyId: initialValues.renewsPolicyId ?? '',
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
      payments: isEditing
        ? (initialValues.payments ?? []).map((payment) => ({
            ...payment,
            incomes: payment.incomes ?? [],
            expenses: payment.expenses ?? [],
          }))
        : normalizeCreateFormPayments({
            payments: initialValues.payments ?? [],
            defaultCounterparty,
            executorName,
          }),
    });
  }

  const defaultPayment = createPaymentWithDefaultIncome(buildCommissionIncomeNote());
  defaultPayment.expenses = buildDefaultPaymentExpenses(defaultCounterparty, executorName);

  return buildPolicyFormSnapshot({
    number: '',
    insuranceCompanyId: '',
    insuranceTypeId: '',
    renewedById: '',
    renewsPolicyId: '',
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
