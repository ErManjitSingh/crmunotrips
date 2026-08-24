import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchLeadStatusConfig } from '../services/leadStatusConfigApi';
import {
  getLeadStatusOptionsState,
  setLeadStatusOptionsFromApi,
  subscribeLeadStatusOptions,
} from '../lib/leadStatusOptionsStore';
import { useAuth } from './AuthContext';

const LeadStatusOptionsContext = createContext({
  warm: [],
  hot: [],
  cold: [],
  loaded: false,
  refresh: async () => {},
});

export function LeadStatusOptionsProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(() => getLeadStatusOptionsState());

  useEffect(() => subscribeLeadStatusOptions(setState), []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchLeadStatusConfig();
      setLeadStatusOptionsFromApi(data);
    } catch {
      /* keep defaults */
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    refresh();
    return undefined;
  }, [user, refresh]);

  return (
    <LeadStatusOptionsContext.Provider value={{ ...state, refresh }}>
      {children}
    </LeadStatusOptionsContext.Provider>
  );
}

export function useLeadStatusOptions() {
  return useContext(LeadStatusOptionsContext);
}
