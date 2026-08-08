import { useEffect, useState } from 'react';

import { fetchClientLookup } from '../api';
import type { Client } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

export const useClientLookup = (query: string, fallbackClients: Client[]): Client[] => {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(normalizedQuery, 250);
  const [results, setResults] = useState<Client[]>([]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    void fetchClientLookup(debouncedQuery, { pageSize: 20, signal: controller.signal })
      .then((payload) => setResults(payload.results))
      .catch(() => {
        if (!controller.signal.aborted) setResults([]);
      });
    return () => controller.abort();
  }, [debouncedQuery]);

  if (normalizedQuery.length < 2) {
    return fallbackClients;
  }
  return results.length ? results : fallbackClients;
};
