export interface FinancialRecordDraft {
  id?: string;
  amount: string;
  date?: string;
  description?: string;
  source?: string;
  note?: string;
}

export interface PaymentDraft {
  id?: string;
  amount: string;
  description?: string;
  scheduledDate?: string;
  actualDate?: string;
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
  note?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  payments: PaymentDraft[];
  clientId?: string;
  clientName?: string;
}

export const createEmptyRecord = (amount = '0', note = ''): FinancialRecordDraft => ({
  amount,
  date: '',
  description: '',
  source: '',
  note,
});

export const createEmptyPayment = (): PaymentDraft => ({
  amount: '0',
  description: '',
  scheduledDate: '',
  actualDate: '',
  incomes: [],
  expenses: [],
});

export const createPaymentWithDefaultIncome = (note?: string): PaymentDraft => ({
  ...createEmptyPayment(),
  incomes: [createEmptyRecord('0', note ?? '')],
});
