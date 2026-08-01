import {
  Building2,
  Car,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  Sparkles,
} from 'lucide-react';
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

function statusTone(status) {
  const s = String(status || 'pending').toLowerCase();
  if (['confirmed', 'completed', 'paid', 'booked'].includes(s)) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (['requested', 'partial', 'in_progress', 'pending_verification'].includes(s)) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  if (['rejected', 'cancelled', 'refund_pending'].includes(s)) {
    return 'bg-rose-50 text-rose-800 border-rose-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function StatusPill({ status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        statusTone(status)
      )}
    >
      {String(status || 'pending').replace(/_/g, ' ')}
    </span>
  );
}

function SummaryChip({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    sky: 'bg-sky-50 border-sky-200 text-sky-900',
  };
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', tones[tone] || tones.slate)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide opacity-70">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyRow({ text }) {
  return <p className="px-3 py-4 text-center text-xs text-slate-500">{text}</p>;
}

/**
 * Live operations + installment status for sales (converted leads).
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

  return (
    <div id="ops-fulfillment" className={cn(DETAIL_CARD, 'mb-6 overflow-hidden scroll-mt-24')}>
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Operations &amp; payment status
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Live hotel, cab &amp; installment progress from Operations
          {summary.bookingNumber ? ` · ${summary.bookingNumber}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 py-4 sm:grid-cols-4">
        <SummaryChip
          icon={Building2}
          label="Hotels"
          value={`${counts.hotelsConfirmed || 0}/${counts.hotelsTotal || 0} confirmed`}
          tone={counts.hotelsTotal && counts.hotelsConfirmed === counts.hotelsTotal ? 'emerald' : 'amber'}
        />
        <SummaryChip
          icon={Car}
          label="Cabs"
          value={`${counts.cabsConfirmed || 0}/${counts.cabsTotal || 0} confirmed`}
          tone={counts.cabsTotal && counts.cabsConfirmed === counts.cabsTotal ? 'emerald' : 'sky'}
        />
        <SummaryChip
          icon={CreditCard}
          label="Installments"
          value={`${counts.installmentsPaid || 0}/${counts.installmentsTotal || 0} paid`}
          tone="amber"
        />
        <SummaryChip
          icon={CheckCircle2}
          label="Booking"
          value={ops?.bookingStatusLabel || ops?.hotelConfirmation || 'pending'}
          tone="slate"
        />
      </div>

      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
        <section className="rounded-xl border border-subtle overflow-hidden">
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Hotels</p>
            <StatusPill status={ops?.hotelConfirmation || 'pending'} />
          </div>
          <div className="divide-y divide-subtle max-h-56 overflow-y-auto">
            {hotels.length === 0 ? (
              <EmptyRow text="No hotel assignments yet" />
            ) : (
              hotels.map((h) => (
                <div key={h.id || `${h.name}-${h.day}`} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{h.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {h.day ? `Day ${h.day}` : '—'}
                      {h.nights ? ` · ${h.nights}N` : ''}
                      {h.roomType ? ` · ${h.roomType}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatDate(h.checkIn)} → {formatDate(h.checkOut)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <StatusPill status={h.status} />
                    {h.voucherSent ? (
                      <p className="text-[10px] font-semibold text-emerald-700">Voucher sent</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-subtle overflow-hidden">
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Cabs / transport</p>
            <StatusPill status={ops?.cabConfirmation || 'pending'} />
          </div>
          <div className="divide-y divide-subtle max-h-56 overflow-y-auto">
            {transport.length === 0 ? (
              <EmptyRow text="No cab assignments yet" />
            ) : (
              transport.map((t) => (
                <div key={t.id || `${t.vehicleType}-${t.day}`} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 capitalize">
                      {String(t.vehicleType || 'cab').replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t.day ? `Day ${t.day}` : t.days?.length ? `Days ${t.days.join(', ')}` : '—'}
                      {t.driverName ? ` · ${t.driverName}` : ''}
                    </p>
                    {(t.pickupLocation || t.dropLocation) && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {[t.pickupLocation, t.dropLocation].filter(Boolean).join(' → ')}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <StatusPill status={t.status} />
                    {t.voucherSent ? (
                      <p className="text-[10px] font-semibold text-emerald-700">Voucher sent</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {activities.length > 0 && (
          <section className="rounded-xl border border-subtle overflow-hidden lg:col-span-2">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Activities</p>
            </div>
            <div className="divide-y divide-subtle">
              {activities.map((a) => (
                <div key={a.id || a.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{a.name}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(a.scheduledAt)}</p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-subtle overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Installments schedule
            </p>
            <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
              Advance {formatINR(summary.advanceReceived)} · Balance {formatINR(summary.balanceDue)}
            </p>
          </div>
          <div className="divide-y divide-subtle">
            {installments.length === 0 ? (
              <EmptyRow text="No installment schedule yet — complete commercial form after convert" />
            ) : (
              installments.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{row.label}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock3 className="h-3 w-3" />
                      Due {formatDate(row.dueDate)}
                      {row.percent ? ` · ${row.percent}%` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <p className="text-sm font-bold tabular-nums text-slate-900">{formatINR(row.amount)}</p>
                    <StatusPill status={row.status} />
                  </div>
                </div>
              ))
            )}
          </div>
          {received.length > 0 && (
            <div className="border-t border-subtle bg-emerald-50/40 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 mb-1.5">
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
        </section>
      </div>
    </div>
  );
}
