import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export default function AppDrawer({
  open,
  onClose,
  children,
  side = 'right',
  className,
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const slideFrom = side === 'right' ? '100%' : '-100%';

  return createPortal(
    <AnimatePresence mode="wait">
      {open && (
        <div className="fixed inset-0 z-[200]" role="presentation">
          <motion.div
            key="app-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-[8px]"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.aside
            key="app-drawer-panel"
            role="dialog"
            aria-modal="true"
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className={cn(
              'fixed inset-y-0 z-10 flex flex-col w-full bg-surface border-subtle shadow-2xl shadow-black/40',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              !className?.includes('max-w-') && 'max-w-md',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
