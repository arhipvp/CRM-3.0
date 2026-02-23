import type { AddFinancialRecordFormValues } from '../components/forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../components/forms/AddPaymentForm';
import type { AddTaskFormValues } from '../components/forms/AddTaskForm';
import type { DealFormValues } from '../components/forms/DealForm';
import type { PolicyFormValues } from '../components/forms/addPolicy/types';
import type {
  Client,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  Statement,
  Task,
  User,
} from '../types';

export type AppOrchestratorState = {
  clients: Client[];
  deals: Deal[];
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  statements: Statement[];
  tasks: Task[];
  users: User[];
  isSyncing: boolean;
  error: string | null;
};

export type DealLifecycleActions = {
  closeDeal: (
    dealId: string,
    payload: { reason: string; status?: 'won' | 'lost' },
  ) => Promise<void>;
  reopenDeal: (dealId: string) => Promise<void>;
  updateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  deleteDeal: (dealId: string) => Promise<void>;
  restoreDeal: (dealId: string) => Promise<void>;
};

export type AppOrchestratorActions = DealLifecycleActions & {
  addTask: (dealId: string, values: AddTaskFormValues) => Promise<void>;
  updateTask: (taskId: string, values: Partial<AddTaskFormValues>) => Promise<void>;
  addPolicy: (dealId: string, values: PolicyFormValues) => Promise<void>;
  addPayment: (values: AddPaymentFormValues) => Promise<void>;
  addFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  clearError: () => void;
};
