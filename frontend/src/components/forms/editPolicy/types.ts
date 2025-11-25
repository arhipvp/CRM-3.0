export interface PolicyEditFormValues {
  number: string;
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
}
