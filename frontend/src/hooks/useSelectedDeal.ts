import { useMemo } from 'react';

import type { Client, Deal, User } from '../types';

interface UseSelectedDealArgs {
  deals: Deal[];
  clients: Client[];
  users: User[];
  selectedDealId: string | null;
}

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
}: UseSelectedDealArgs): SelectedDealResult => {
  const clientsById = new Map<string, Client>();
  clients.forEach((client) => clientsById.set(client.id, client));

  const usersById = new Map<string, User>();
  users.forEach((user) => usersById.set(user.id, user));

  const sortedDeals = deals;

  const selectedDeal = selectedDealId
    ? sortedDeals.find((deal) => deal.id === selectedDealId) ?? null
    : sortedDeals[0] ?? null;

  const selectedClient = selectedDeal ? clientsById.get(selectedDeal.clientId) ?? null : null;
  const sellerUser = selectedDeal ? usersById.get(selectedDeal.seller ?? '') : undefined;
  const executorUser = selectedDeal ? usersById.get(selectedDeal.executor ?? '') : undefined;

  return { sortedDeals, selectedDeal, selectedClient, sellerUser, executorUser };
};

export const useSelectedDeal = ({
  deals,
  clients,
  users,
  selectedDealId,
}: UseSelectedDealArgs) =>
  useMemo(
    () => computeSelectedDeal({ deals, clients, users, selectedDealId }),
    [deals, clients, users, selectedDealId]
  );
