import { request } from './request';
import { buildQueryString, FilterParams, unwrapList } from './helpers';
import { mapInsuranceCompany, mapInsuranceType, mapSalesChannel } from './mappers';
import type { InsuranceCompany, InsuranceType, SalesChannel } from '../types';

export async function fetchInsuranceCompanies(
  filters?: FilterParams
): Promise<InsuranceCompany[]> {
  const qs = buildQueryString(filters);
  const payload = await request(`/insurance_companies/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapInsuranceCompany);
}

export async function fetchInsuranceTypes(
  filters?: FilterParams
): Promise<InsuranceType[]> {
  const qs = buildQueryString(filters);
  const payload = await request(`/insurance_types/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapInsuranceType);
}

export async function fetchSalesChannels(): Promise<SalesChannel[]> {
  const payload = await request('/sales_channels/');
  return unwrapList<Record<string, unknown>>(payload).map(mapSalesChannel);
}
