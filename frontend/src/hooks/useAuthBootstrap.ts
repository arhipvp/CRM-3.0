import { useCallback, useEffect, useState } from 'react';

import { clearTokens, getCurrentUser, hasStoredTokens } from '../api';
import type { User } from '../types';
import { mapApiUser } from '../utils/appContent';

export const useAuthBootstrap = (loadData: () => Promise<void>) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!hasStoredTokens()) {
      setAuthLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const userData = await getCurrentUser();
        if (!userData?.is_authenticated) {
          clearTokens();
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }
        const user = mapApiUser(userData);
        setCurrentUser(user);
        setIsAuthenticated(true);
        await loadData();
      } catch (err) {
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [loadData]);

  const handleLoginSuccess = useCallback(async () => {
    const userData = await getCurrentUser();
    const user = mapApiUser(userData);
    setCurrentUser(user);
    setIsAuthenticated(true);
    await loadData();
  }, [loadData]);

  return {
    authLoading,
    currentUser,
    handleLoginSuccess,
    isAuthenticated,
    setCurrentUser,
    setIsAuthenticated,
  };
};
