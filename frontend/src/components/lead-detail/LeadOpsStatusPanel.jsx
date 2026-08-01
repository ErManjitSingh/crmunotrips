import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { DETAIL_CARD } from './leadDetailUtils';
import { cn } from '../../lib/utils';

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(checkIn, checkOut) {
  if (!checkIn && !checkOut) return '—';
  if (checkIn && checkOut) return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
  return formatDate(checkIn || checkOut);
}

function isPositiveStatus(status) {
  const s = String(status || '').toLowerCase();
  return ['confirmed', 'completed', 'paid', 'booked', 'active'].includes(s);
}

function StatusBadge({ status, size = 'sm' }) {
  const s = String(status || 'pending').toLowerCase();
  const ok = isPositiveStatus(s);
  const pending = ['pending', 'requested', 'partial', 'in_progress', 'pending_verification'].includes(s);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold uppercase tracking-wide',
        size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1 text-[11px]',
        ok && 'bg-emerald-100 text-emerald-700',
        pending && !ok && 'bg-amber-100 text-amber-700',
        !ok && !pending && 'bg-slate-100 text-slate-600'
      )}
    >
      {s.replace(/_/g, ' ')}
    </span>
  );
}

/** Header luggage + card illustration */
function OpsHeroArt({ className }) {
  return (
    <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <ellipse cx="80" cy="88" rx="54" ry="8" fill="#E0E7FF" opacity="0.7" />
      <rect x="18" y="38" width="52" height="42" rx="8" fill="#A78BFA" />
      <rect x="24" y="44" width="40" height="10" rx="3" fill="#C4B5FD" />
      <rect x="28" y="28" width="32" height="12" rx="4" fill="#8B5CF6" />
      <circle cx="44" cy="68" r="5" fill="#7C3AED" />
      <rect x="78" y="22" width="68" height="44" rx="10" fill="url(#opsCardGrad)" />
      <rect x="88" y="34" width="28" height="8" rx="2" fill="#FDE68A" opacity="0.9" />
      <rect x="88" y="48" width="40" height="5" rx="2" fill="white" opacity="0.55" />
      <rect x="88" y="56" width="24" height="4" rx="2" fill="white" opacity="0.35" />
      <circle cx="132" cy="52" r="10" fill="white" opacity="0.25" />
      <circle cx="122" cy="52" r="10" fill="white" opacity="0.18" />
      <defs>
        <linearGradient id="opsCardGrad" x1="78" y1="22" x2="146" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function HotelThumbSvg({ seed = 0, className }) {
  const skies = ['#93C5FD', '#A5B4FC', '#67E8F9', '#C4B5FD'];
  const buildings = ['#F97316', '#FB7185', '#34D399', '#FBBF24'];
  const sky = skies[seed % skies.length];
  const building = buildings[seed % buildings.length];
  return (
    <svg viewBox="0 0 56 56" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="56" height="56" rx="12" fill={sky} />
      <ellipse cx="28" cy="48" rx="26" ry="10" fill="#86EFAC" opacity="0.85" />
      <rect x="10" y="18" width="36" height="28" rx="3" fill={building} />
      <rect x="14" y="22" width="6" height="6" rx="1" fill="#FEF3C7" opacity="0.9" />
      <rect x="25" y="22" width="6" height="6" rx="1" fill="#FEF3C7" opacity="0.9" />
      <rect x="36" y="22" width="6" height="6" rx="1" fill="#FEF3C7" opacity="0.9" />
      <rect x="14" y="32" width="6" height="6" rx="1" fill="#FEF3C7" opacity="0.7" />
      <rect x="25" y="32" width="6" height="6" rx="1" fill="#FEF3C7" opacity="0.7" />
      <rect x="36" y="32" width="6" height="6" rx="1" fill="#FEF3C7" opacity="0.7" />
      <rect x="24" y="38" width="8" height="8" rx="1" fill="#7C2D12" opacity="0.5" />
      <circle cx="44" cy="12" r="6" fill="#FDE68A" opacity="0.85" />
    </svg>
  );
}

function HotelIconSvg({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 20V8.5A2.5 2.5 0 0 1 6.5 6H17.5A2.5 2.5 0 0 1 20 8.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M2 20h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 10h1.5M13.5 10H15M9 14h1.5M13.5 14H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 20v-4h2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CabIconSvg({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 15.5h16l-1.2-4.2A2 2 0 0 0 16.9 10H7.1a2 2 0 0 0-1.9 1.3L4 15.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M6.5 10.2 7.8 7.4A1.5 1.5 0 0 1 9.2 6.5h5.6a1.5 1.5 0 0 1 1.4.9l1.3 2.8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="7.5" cy="16.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16.5" cy="16.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.2 16.5h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CabHeroArt({ className }) {
  return (
    <svg viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <ellipse cx="140" cy="138" rx="90" ry="12" fill="#E0E7FF" />
      <path
        d="M48 108c18-28 52-46 92-46s74 18 92 46"
        stroke="#C7D2FE"
        strokeWidth="3"
        strokeDasharray="6 8"
        fill="none"
      />
      <g transform="translate(168 28)">
        <path
          d="M18 2c0 10-8 16-8 26 0 6 4 10 8 10s8-4 8-10c0-10-8-16-8-26Z"
          fill="#EF4444"
        />
        <circle cx="18" cy="38" r="5" fill="white" />
      </g>
      <g transform="translate(40 58)">
        <path
          d="M28 52h144c8 0 14 4 16 12l6 22H18l4-18c2-10 8-16 16-16Z"
          fill="url(#cabBody)"
        />
        <path
          d="M52 52c8-22 28-34 56-34 22 0 40 8 50 26l8 8H60l-8-0Z"
          fill="#4F46E5"
        />
        <path d="M78 34h36c6 0 10 4 12 10l2 6H68l4-8c2-4 4-8 6-8Z" fill="#A5B4FC" opacity="0.85" />
        <path d="M128 34h22c4 0 7 3 8 7l3 9h-28l-5-16Z" fill="#C4B5FD" opacity="0.9" />
        <rect x="34" y="64" width="18" height="6" rx="2" fill="#FDE68A" />
        <rect x="168" y="64" width="12" height="6" rx="2" fill="#FCA5A5" />
        <circle cx="64" cy="90" r="16" fill="#1E1B4B" />
        <circle cx="64" cy="90" r="8" fill="#94A3B8" />
        <circle cx="160" cy="90" r="16" fill="#1E1B4B" />
        <circle cx="160" cy="90" r="8" fill="#94A3B8" />
        <path d="M88 70h40" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      </g>
      <defs>
        <linearGradient id="cabBody" x1="28" y1="52" x2="194" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CalendarIconSvg({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SummaryCard({ tone, icon, label, value, sub, done }) {
  const tones = {
    green: {
      card: 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100',
      iconWrap: 'bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-emerald-200',
      value: 'text-emerald-900',
      sub: 'text-emerald-600',
    },
    blue: {
      card: 'bg-gradient-to-br from-sky-50 to-blue-50 border-sky-100',
      iconWrap: 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sky-200',
      value: 'text-sky-900',
      sub: 'text-sky-600',
    },
    orange: {
      card: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100',
      iconWrap: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-200',
      value: 'text-amber-900',
      sub: 'text-amber-600',
    },
    purple: {
      card: 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100',
      iconWrap: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-200',
      value: 'text-violet-900',
      sub: 'text-violet-600',
    },
  };
  const t = tones[tone] || tones.purple;

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm', t.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl shadow-md', t.iconWrap)}>
          {icon}
        </div>
        {done ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-emerald-600 shadow-sm">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-slate-400">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 text-lg font-extrabold leading-tight tabular-nums', t.value)}>{value}</p>
      <p className={cn('mt-1 text-xs font-semibold', t.sub)}>{sub}</p>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p className="px-4 py-8 text-center text-sm text-slate-500">{text}</p>;
}

/**
 * Live operations + installment status for sales (converted leads).
 * Visual layout matches the Operations & Payment Status mockup.
 */
export default function LeadOpsStatusPanel({ lead, paymentSummary }) {
  const summary = paymentSummary || lead?.paymentSummary;
  const ops = summary?.ops;
  if (!summary || lead?.status !== 'converted') return null;
  if (!ops && !summary.bookingId) return null;

  const counts = ops?.counts || {};
  const hotels = ops?.hotels || [];
  const transport = ops?.transport || [];
  const activities = ops?.activities || [];
  const installments = ops?.scheduledInstallments || [];
  const received = ops?.receivedInstallments || [];

  const hotelsDone =
    counts.hotelsTotal > 0 && counts.hotelsConfirmed === counts.hotelsTotal;
  const cabsDone =
    counts.cabsTotal > 0 && counts.cabsConfirmed === counts.cabsTotal;
  const installmentsDone =
    counts.installmentsTotal > 0 && counts.installmentsPaid === counts.installmentsTotal;

  const hotelPct = counts.hotelsTotal
    ? Math.round((counts.hotelsConfirmed / counts.hotelsTotal) * 100)
    : 0;
  const cabPct = counts.cabsTotal
    ? Math.round((counts.cabsConfirmed / counts.cabsTotal) * 100)
    : 0;
  const payPct = counts.installmentsTotal
    ? Math.round((counts.installmentsPaid / counts.installmentsTotal) * 100)
    : 0;

  const bookingLabel = ops?.bookingStatusLabel || ops?.hotelConfirmation || 'Pending';
  const bookingActive = isPositiveStatus(ops?.bookingStatus) || isPositiveStatus(bookingLabel);

  const scrollToInstallments = () => {
    document.getElementById('payment-advance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      id="ops-fulfillment"
      className={cn(DETAIL_CARD, 'mb-6 overflow-hidden scroll-mt-24 border-0 shadow-md ring-1 ring-slate-200/80')}
    >
      {/* Header */}
      <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/60 px-5 py-5 sm:px-6">
        <div className="relative z-10 max-w-[70%]">
          <h3 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Operations &amp; Payment Status{' '}
            <span aria-hidden className="inline-block">✨</span>
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Live hotel, cab &amp; installment progress from Operations
            {summary.bookingNumber ? (
              <span className="font-semibold text-violet-600">
                {' '}
                • {summary.bookingNumber}
              </span>
            ) : null}
          </p>
        </div>
        <OpsHeroArt className="pointer-events-none absolute -right-2 top-1 h-24 w-40 opacity-90 sm:right-4 sm:h-28 sm:w-48" />
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            tone="green"
            label="Hotels"
            value={`${counts.hotelsConfirmed || 0}/${counts.hotelsTotal || 0} Confirmed`}
            sub={`${hotelPct}% Confirmed`}
            done={hotelsDone}
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M4 21V9l8-5 8 5v12h-5v-6H9v6H4z" />
              </svg>
            }
          />
          <SummaryCard
            tone="blue"
            label="Cabs / Transport"
            value={`${counts.cabsConfirmed || 0}/${counts.cabsTotal || 0} Confirmed`}
            sub={`${cabPct}% Confirmed`}
            done={cabsDone}
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M5 16l1.5-4.5A2 2 0 018.4 10h7.2a2 2 0 011.9 1.5L19 16H5zm1.5 1a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm11 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM7.5 9l1.2-2.4A1 1 0 019.6 6h4.8a1 1 0 01.9.6L16.5 9H7.5z" />
              </svg>
            }
          />
          <SummaryCard
            tone="orange"
            label="Installments"
            value={`${counts.installmentsPaid || 0}/${counts.installmentsTotal || 0} Paid`}
            sub={`${payPct}% Paid`}
            done={installmentsDone}
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v2H4V6zm0 4h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8zm3 4h4v2H7v-2z" />
              </svg>
            }
          />
          <SummaryCard
            tone="purple"
            label="Booking Status"
            value={bookingLabel}
            sub={bookingActive ? 'Booking Active' : 'Awaiting confirmation'}
            done={bookingActive}
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.3 7.3a1 1 0 00-1.4-1.4L11 11.6l-1.9-1.9a1 1 0 10-1.4 1.4l2.6 2.6a1 1 0 001.4 0l4.6-4.4z"
                  clipRule="evenodd"
                />
              </svg>
            }
          />
        </div>

        {/* Hotels + Cabs */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <HotelIconSvg className="h-5 w-5" />
                </span>
                <h4 className="text-sm font-bold text-slate-900">Hotels</h4>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                onClick={() => document.getElementById('ops-hotels-list')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View All Hotels
              </button>
            </div>
            <div id="ops-hotels-list" className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {hotels.length === 0 ? (
                <EmptyRow text="No hotel assignments yet" />
              ) : (
                hotels.map((h, idx) => (
                  <div
                    key={h.id || `${h.name}-${h.day}-${idx}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80"
                  >
                    <HotelThumbSvg seed={idx} className="h-12 w-12 shrink-0 rounded-xl shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{h.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {h.day ? `Day ${h.day}` : 'Stay'}
                        {h.nights ? ` • ${h.nights}N` : ''}
                        {h.roomType ? ` • ${h.roomType}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">{formatDateRange(h.checkIn, h.checkOut)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={h.status} />
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <CabIconSvg className="h-5 w-5" />
                </span>
                <h4 className="text-sm font-bold text-slate-900">Cabs / Transport</h4>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ops?.cabConfirmation || 'pending'} />
                <span className="text-xs font-semibold text-violet-600">View Details</span>
              </div>
            </div>
            <div className="px-4 py-4">
              {transport.length === 0 ? (
                <EmptyRow text="No cab assignments yet" />
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {transport.map((t, idx) => (
                      <span
                        key={t.id || idx}
                        className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold capitalize text-violet-800"
                      >
                        {String(t.vehicleType || 'cab').replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  <CabHeroArt className="mx-auto h-36 w-full max-w-sm" />
                  <div className="mt-2 space-y-2">
                    {transport.map((t, idx) => (
                      <div
                        key={`detail-${t.id || idx}`}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 capitalize">
                            {String(t.vehicleType || 'cab').replace(/_/g, ' ')}
                            {t.day ? ` · Day ${t.day}` : ''}
                            {t.driverName ? ` · ${t.driverName}` : ''}
                          </p>
                          {(t.pickupLocation || t.dropLocation) && (
                            <p className="truncate text-[11px] text-slate-500">
                              {[t.pickupLocation, t.dropLocation].filter(Boolean).join(' → ')}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {activities.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                  <path d="M12 2l1.8 5.5L19 9.2l-4.2 3.2L16 18l-4-2.8L8 18l1.2-5.6L5 9.2l5.2-1.7L12 2z" />
                </svg>
              </span>
              <h4 className="text-sm font-bold text-slate-900">Activities</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {activities.map((a) => (
                <div key={a.id || a.name} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(a.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Installments timeline */}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <CalendarIconSvg className="h-5 w-5" />
              </span>
              <h4 className="text-sm font-bold text-slate-900">Installments Schedule</h4>
            </div>
            <p className="text-xs font-semibold tabular-nums text-slate-500">
              Advance {formatINR(summary.advanceReceived)} • Balance {formatINR(summary.balanceDue)}
            </p>
          </div>

          <div className="px-4 py-4">
            {installments.length === 0 ? (
              <EmptyRow text="No installment schedule yet — complete commercial form after convert" />
            ) : (
              <ol className="relative space-y-0">
                <div
                  className="absolute left-[15px] top-3 bottom-3 w-px border-l-2 border-dashed border-violet-300"
                  aria-hidden
                />
                {installments.map((row, idx) => (
                  <li key={`${row.label}-${idx}`} className="relative flex gap-3 pb-5 last:pb-0">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-extrabold text-white shadow-md shadow-violet-200">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {row.label || `Installment ${idx + 1}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Due {formatDate(row.dueDate)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.percent ? (
                          <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-violet-600 ring-1 ring-violet-100">
                            {row.percent}%
                          </span>
                        ) : null}
                        <p className="text-sm font-extrabold tabular-nums text-slate-900">{formatINR(row.amount)}</p>
                        <StatusBadge status={row.status} />
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {received.length > 0 && (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  Payments received
                </p>
                <div className="space-y-1">
                  {received.map((row, idx) => (
                    <p key={idx} className="text-xs text-emerald-900">
                      {formatINR(row.amount)}
                      {row.method ? ` · ${row.method}` : ''}
                      {row.receivedAt ? ` · ${formatDate(row.receivedAt)}` : ''}
                      {row.reference ? ` · Ref ${row.reference}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={scrollToInstallments}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:from-violet-700 hover:to-indigo-700"
            >
              View Installment Details
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
