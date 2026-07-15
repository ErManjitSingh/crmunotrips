import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSidebar } from '../../context/SidebarContext';
import AppSidebar from './AppSidebar';
import { cn } from '../../lib/utils';

/**
 * Mobile sidebar overlay. Instant unmount on close (no exit animation ghosts).
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

  // Capture any in-drawer navigation (Link / <a>) and force-close before paint settle.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onNav = (e) => {
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
      setMobileOpen(false);
    };
    document.addEventListener('click', onNav, true);
    return () => document.removeEventListener('click', onNav, true);
  }, [mobileOpen, setMobileOpen]);

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
          'absolute inset-y-0 left-0 w-[min(280px,88vw)] max-w-full shadow-2xl',
          panelClassName
        )}
      >
        <AppSidebar {...sidebarProps} className="h-full w-full !max-w-none" />
      </div>
    </div>,
    document.body
  );
}
