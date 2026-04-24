import { useMemo } from 'react';

import type { Client, Deal, User } from '../types';

interface UseSelectedDealArgs {
  deals: Deal[];
  clients: Client[];
  users: User[];
  selectedDealId: string | null;
  isDealFocusCleared?: boolean;
}

export const resolveEffectiveSelectedDealId = ({
  selectedDealId,
}: Pick<UseSelectedDealArgs, 'deals' | 'selectedDealId' | 'isDealFocusCleared'>): string | null => {
  if (selectedDealId) {
    return selectedDealId;
  }
  return null;
};

export interface SelectedDealResult {
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
  selectedClient: Client | null;
  sellerUser: User | undefined;
  executorUser: User | undefined;
}

export const computeSelectedDeal = ({
  deals,
  clients,
  users,
  selectedDealId,
  isDealFocusCleared = false,
}: UseSelectedDealArgs): SelectedDealResult => {
  const clientsById = new Map<string, Client>();
  clients.forEach((client) => clientsById.set(client.id, client));

  const usersById = new Map<string, User>();
  users.forEach((user) => usersById.set(user.id, user));

  const sortedDeals = deals;
  const effectiveSelectedDealId = resolveEffectiveSelectedDealId({
    deals: sortedDeals,
    selectedDealId,
    isDealFocusCleared,
  });

  const selectedDeal = effectiveSelectedDealId
    ? (sortedDeals.find((deal) => deal.id === effectiveSelectedDealId) ?? null)
    : null;

  const selectedClient = selectedDeal ? (clientsById.get(selectedDeal.clientId) ?? null) : null;
  const sellerUser = selectedDeal ? usersById.get(selectedDeal.seller ?? '') : undefined;
  const executorUser = selectedDeal ? usersById.get(selectedDeal.executor ?? '') : undefined;

  return { sortedDeals, selectedDeal, selectedClient, sellerUser, executorUser };
};

export const useSelectedDeal = ({
  deals,
  clients,
  users,
  selectedDealId,
  isDealFocusCleared = false,
}: UseSelectedDealArgs) =>
  useMemo(
    () => computeSelectedDeal({ deals, clients, users, selectedDealId, isDealFocusCleared }),
    [deals, clients, users, selectedDealId, isDealFocusCleared],
  );
