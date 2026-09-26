import { request } from './request';
import { buildQueryString, unwrapList, type FilterParams } from './helpers';

export type DataRecord = {
  id: string;
  is_current?: boolean;
  deleted_at?: string | null;
  [key: string]: unknown;
};
export type DataResource =
  | 'participants'
  | 'passports'
  | 'driver-licenses'
  | 'vehicles'
  | 'vehicle-registrations'
  | 'vehicle-titles'
  | 'mortgages'
  | 'mortgage-balances'
  | 'platforms'
  | 'requests'
  | 'variants';

export async function listInsuranceData(
  resource: DataResource,
  filters: FilterParams = {},
  signal?: AbortSignal,
): Promise<DataRecord[]> {
  const records: DataRecord[] = [];
  let page = 1;
  for (;;) {
    const payload = await request<{ results: DataRecord[]; next?: string } | DataRecord[]>(
      `/insurance-data/${resource}/${buildQueryString({ ...filters, page, page_size: 100 })}`,
      { signal },
    );
    records.push(...unwrapList<DataRecord>(payload));
    if (Array.isArray(payload) || !payload.next) return records;
    page += 1;
  }
}

export function saveInsuranceData(
  resource: DataResource,
  data: Record<string, unknown>,
  id?: string,
): Promise<DataRecord> {
  return request(`/insurance-data/${resource}/${id ? `${id}/` : ''}`, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(data),
  });
}

export function insuranceDataAction(
  resource: DataResource,
  id: string,
  action: 'delete' | 'restore' | 'close' | 'reopen' | 'copy',
): Promise<DataRecord> {
  return request(`/insurance-data/${resource}/${id}/${action === 'delete' ? '' : `${action}/`}`, {
    method: action === 'delete' ? 'DELETE' : 'POST',
  });
}

export const recordLabel = (record: DataRecord): string =>
  String(
    record.title ||
      record.name ||
      record.client_name ||
      [record.series, record.number].filter(Boolean).join(' ') ||
      record.amount ||
      record.id,
  );
export const isSelectableRecord = (record: DataRecord): boolean =>
  !record.deleted_at && record.is_current !== false && !record.client_deleted_at;

export function normalizeExperienceDate(value: string): string {
  return /^\d{4}$/.test(value.trim()) ? `${value.trim()}-12-31` : value;
}

export function parseDeductibles(value: string): string[] {
  const parts = value
    .split(/[;\n]/)
    .map((item) => item.trim().replace(',', '.'))
    .filter(Boolean);
  if (!parts.length || parts.some((item) => !/^\d+(\.\d{1,2})?$/.test(item)))
    throw new Error('Укажите франшизы в рублях через точку с запятой, например: 0; 30000.');
  return [...new Set(parts.map((item) => Number(item).toFixed(2)))];
}
