import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext(null);

const STORAGE_KEY = 'uno-sidebar-collapsed';

export function SidebarProvider({ children }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [mobileOpen, setMobileOpenState] = useState(false);

  const setMobileOpen = useCallback((next) => {
    setMobileOpenState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      return Boolean(value);
    });
  }, []);

  useLayoutEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Close drawer on every navigation (including same-path pushes with new key).
  useLayoutEffect(() => {
    setMobileOpenState(false);
  }, [location.key]);

  const toggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);
  const toggleMobileOpen = useCallback(() => {
    setMobileOpenState((prev) => !prev);
  }, []);
  const effectiveCollapsed = mobileOpen ? false : collapsed;
  const value = useMemo(
    () => ({
      collapsed: effectiveCollapsed,
      rawCollapsed: collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      toggleMobileOpen,
      expandedWidth: 240,
      collapsedWidth: 72,
    }),
    [effectiveCollapsed, collapsed, toggleCollapsed, mobileOpen, setMobileOpen, toggleMobileOpen]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
