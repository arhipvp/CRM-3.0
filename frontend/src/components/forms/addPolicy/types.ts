export interface FinancialRecordDraft {
  amount: string;
  date?: string;
  description?: string;
  source?: string;
  note?: string;
}

export interface PaymentDraft {
  amount: string;
  description?: string;
  scheduledDate?: string;
  actualDate?: string;
  incomes: FinancialRecordDraft[];
  expenses: FinancialRecordDraft[];
}

export interface PolicyFormValues {
  number: string;
  clientId: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  payments: PaymentDraft[];
}

export const createEmptyRecord = (): FinancialRecordDraft => ({
  amount: '',
  date: '',
  description: '',
  source: '',
  note: '',
});

export const createEmptyPayment = (): PaymentDraft => ({
  amount: '',
  description: '',
  scheduledDate: '',
  actualDate: '',
  incomes: [],
  expenses: [],
});
