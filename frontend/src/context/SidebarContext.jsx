import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const SidebarContext = createContext(null);

const STORAGE_KEY = 'uno-sidebar-collapsed';

export function SidebarProvider({ children }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Close mobile drawer after every navigation (link click, bottom nav, programmatic).
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);
  const effectiveCollapsed = mobileOpen ? false : collapsed;

  return (
    <SidebarContext.Provider
      value={{
        collapsed: effectiveCollapsed,
        rawCollapsed: collapsed,
        setCollapsed,
        toggleCollapsed,
        mobileOpen,
        setMobileOpen,
        expandedWidth: 240,
        collapsedWidth: 72,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
