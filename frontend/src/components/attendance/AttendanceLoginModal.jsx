import { useState } from 'react';
import { Building2, LogIn } from 'lucide-react';
import API from '../../api/axios';
import AppModal from '../ui/AppModal';

export default function AttendanceLoginModal({ open, onSuccess }) {
  const [acting, setActing] = useState(false);

  const handleCheckIn = async () => {
    setActing(true);
    try {
      await API.post(
        '/attendance/check-in',
        { workMode: 'office' },
        { successMessage: 'Office check-in completed' }
      );
      onSuccess?.();
    } finally {
      setActing(false);
    }
  };

  return (
    <AppModal open={open} size="md" closeOnBackdrop={false} lockDismiss onClose={() => {}}>
      <div className="p-6 sm:p-8 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg mb-4">
          <LogIn className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-content-primary">Mark your attendance</h2>
        <p className="text-sm text-content-secondary mt-2 mb-6">
          Please check in for today before continuing.
        </p>

        <button
          type="button"
          disabled={acting}
          onClick={handleCheckIn}
          className="inline-flex flex-col items-center gap-3 p-5 rounded-xl border border-subtle hover:border-brand-500/50 bg-surface-elevated/50 hover:bg-surface-elevated transition-all disabled:opacity-60 w-full max-w-xs mx-auto"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <span className="font-semibold text-content-primary">Office Check-in</span>
        </button>

        <p className="text-xs text-content-muted mt-5">You can check in only once per day.</p>
      </div>
    </AppModal>
  );
}
