import { useMemo } from 'react';

import type { Client, Deal, User } from '../types';

interface UseSelectedDealArgs {
  deals: Deal[];
  clients: Client[];
  users: User[];
  selectedDealId: string | null;
}

export const useSelectedDeal = ({
  deals,
  clients,
  users,
  selectedDealId,
}: UseSelectedDealArgs) => {
  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => map.set(client.id, client));
    return map;
  }, [clients]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const deletedA = Boolean(a.deletedAt);
      const deletedB = Boolean(b.deletedAt);
      if (deletedA !== deletedB) {
        return deletedA ? 1 : -1;
      }
      const dateA = a.nextContactDate ? new Date(a.nextContactDate).getTime() : Infinity;
      const dateB = b.nextContactDate ? new Date(b.nextContactDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [deals]);

  const selectedDeal = selectedDealId
    ? sortedDeals.find((deal) => deal.id === selectedDealId) ?? null
    : sortedDeals[0] ?? null;

  const selectedClient = selectedDeal ? clientsById.get(selectedDeal.clientId) ?? null : null;
  const sellerUser = selectedDeal ? usersById.get(selectedDeal.seller ?? '') : undefined;
  const executorUser = selectedDeal ? usersById.get(selectedDeal.executor ?? '') : undefined;

  return { sortedDeals, selectedDeal, selectedClient, sellerUser, executorUser };
};
