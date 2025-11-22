export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  show_deleted?: boolean;
  [key: string]: unknown;
}

export function buildQueryString(params?: FilterParams): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });
  const qs = queryParams.toString();
  return qs ? `?${qs}` : '';
}

export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (isResultsPayload(payload)) {
    return payload.results as T[];
  }
  return [];
}

function isResultsPayload(value: unknown): value is { results: unknown[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'results' in value && Array.isArray((value as { results: unknown[] }).results);
}

export const toOptionalString = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

export const toNullableString = (value: unknown): string | null =>
  value === undefined || value === null ? null : String(value);

export const toStringValue = (value: unknown, fallback = ''): string =>
  value === undefined || value === null ? fallback : String(value);

export const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};
