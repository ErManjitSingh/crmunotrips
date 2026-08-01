import { Trophy } from 'lucide-react';
import { Button } from '../ui/button';

export default function LeadConvertedBanner({ status, bookingHref, bookingNumber, onViewBooking }) {
  if (status !== 'converted') return null;

  const handleView = () => {
    if (onViewBooking) {
      onViewBooking();
      return;
    }
    if (bookingHref) {
      window.location.assign(bookingHref);
      return;
    }
    document.getElementById('payment-advance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mb-5 rounded-2xl border border-emerald-200/90 bg-[#ecfdf5] px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <div className="p-2 rounded-full bg-emerald-500 text-white shrink-0 shadow-sm shadow-emerald-500/25">
          <Trophy className="w-4 h-4" />
        </div>
        <p className="text-sm font-semibold text-emerald-900 leading-snug">
          Converted! Booking started for this lead. Track hotel, cab & installment status below — customer gets the payment voucher by email.
          {bookingNumber ? (
            <span className="block sm:inline text-emerald-700/90 font-medium mt-0.5 sm:mt-0 sm:ml-1">
              ({bookingNumber})
            </span>
          ) : null}
        </p>
      </div>
      <Button
        type="button"
        onClick={handleView}
        className="shrink-0 rounded-xl h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white border-0 font-semibold shadow-sm"
      >
        View Booking
      </Button>
    </div>
  );
}
