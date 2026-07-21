import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSidebar } from '../../context/SidebarContext';
import AppSidebar from './AppSidebar';
import { cn } from '../../lib/utils';

/**
 * Mobile sidebar overlay. Closes after route change (SidebarContext),
 * not mid-click — so Link navigation is never cancelled.
 */
export default function MobileSidebarDrawer({ sidebarProps, panelClassName = '' }) {
  const { mobileOpen, setMobileOpen } = useSidebar();

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  if (!mobileOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="lg:hidden fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          'absolute inset-0 w-full shadow-2xl',
          panelClassName
        )}
      >
        <AppSidebar {...sidebarProps} className="h-full !w-full !max-w-none" />
      </div>
    </div>,
    document.body
  );
}
