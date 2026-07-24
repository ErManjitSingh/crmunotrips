import { Link } from 'react-router-dom';
import {
  BedDouble,
  CalendarDays,
  Clock3,
  Mail,
  Users,
} from 'lucide-react';
import TablePagination from '../ui/TablePagination';
import { getLeadSourceShortLabel } from '../../lib/leadSourceLabels';
import { cn } from '../../lib/utils';
import LeadCallStats from './LeadCallStats';
import { TooltipProvider } from '../ui/tooltip';

function formatMoney(n) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN')}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatShortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function formatRange(start, end) {
  if (!start && !end) return 'Dates TBD';
  if (!end) return formatShortDate(start);
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return formatShortDate(start);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.getDate()} - ${e.getDate()} ${s.toLocaleDateString('en-IN', { month: 'short' })}, ${String(s.getFullYear()).slice(-2)}`;
  }
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function relativeAgo(value) {
  if (!value) return '';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function daysLeft(date) {
  if (!date) return null;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function tourLabel(lead) {
  const nights = Number(lead.tourDays) > 0
    ? Math.max(0, Number(lead.tourDays) - 1)
    : (() => {
        const d = daysBetween(lead.travelDate, lead.returnDate);
        return d == null ? null : Math.max(0, d);
      })();
  const days = Number(lead.tourDays) > 0
    ? Number(lead.tourDays)
    : nights == null
      ? null
      : nights + 1;
  if (nights == null || days == null) return '—';
  return `${nights}N/${days}D`;
}

function paymentStatusMeta(status) {
  const key = String(status || 'pending').toLowerCase();
  if (key === 'paid') return { label: 'Paid', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (key === 'partial') return { label: 'Partial', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  return { label: 'Pending', className: 'bg-orange-100 text-orange-700 border-orange-200' };
}

function TookBadge({ days, tone = 'blue' }) {
  if (days == null) return <span className="text-[11px] text-slate-400">—</span>;
  const tones = {
    blue: 'bg-sky-100 text-sky-700 border-sky-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  return (
    <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold', tones[tone])}>
      Took {days} day{days === 1 ? '' : 's'}
    </span>
  );
}

function ConvertedLeadRow({ lead, detailHref, onClick }) {
  const pay = lead.paymentSummary || {};
  const bookedAt = pay.paidAt || pay.bookingCreatedAt || lead.updatedAt || lead.createdAt;
  const leadToBook = daysBetween(lead.createdAt, bookedAt);
  const assignedToBook = daysBetween(lead.assignedAt, bookedAt);
  const tripLeft = daysLeft(lead.travelDate);
  const payDue = pay.dueDate || lead.travelDate;
  const payLeft = daysLeft(payDue);
  const total = Number(pay.totalAmount || lead.budget || 0);
  const advance = Number(pay.advanceReceived || 0);
  const balance = Number(pay.balanceDue ?? Math.max(0, total - advance));
  const progress = total > 0 ? Math.min(100, Math.round((advance / total) * 100)) : 0;
  const statusMeta = paymentStatusMeta(pay.status);
  const adults = Number(lead.adults ?? lead.travelers ?? 0) || 0;
  const rooms = Number(lead.numberOfRooms || 1);
  const bookingId = pay.bookingNumber || pay.invoiceNumber || lead.leadId || String(lead._id).slice(-8);
  const salesBy = lead.assignedTo?.name || lead.createdBy?.name || '—';
  const source = getLeadSourceShortLabel(lead.source || lead.leadSource, lead.sourceLabel) || 'CRM';

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(lead)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.(lead);
      }}
      className="grid grid-cols-1 gap-4 border-b border-slate-100 bg-white px-4 py-4 transition-colors hover:bg-slate-50/80 xl:grid-cols-[220px_140px_minmax(200px,1.1fr)_minmax(220px,1.2fr)_minmax(240px,1.3fr)]"
    >
      {/* Booked On */}
      <div className="space-y-2">
        <div className="inline-flex rounded-lg bg-sky-50 px-2.5 py-1.5 text-[12px] font-semibold text-sky-800">
          {formatDateTime(bookedAt)}
        </div>
        {relativeAgo(bookedAt) && (
          <div className="inline-flex rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
            {relativeAgo(bookedAt)}
          </div>
        )}
        <div className="space-y-1.5 pt-1 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Lead → Booking</span>
            <TookBadge days={leadToBook} tone="blue" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Assigned → Booking</span>
            <TookBadge days={assignedToBook} tone="violet" />
          </div>
        </div>
      </div>

      {/* Source */}
      <div className="space-y-2">
        <span className="inline-flex rounded-md bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
          {source}
        </span>
        <p className="text-[12px] text-slate-600">
          Sales by: <span className="font-bold text-slate-900">{salesBy}</span>
        </p>
      </div>

      {/* Guest Info */}
      <div className="space-y-2">
        <div>
          <p className="text-[13px] font-bold text-slate-900">{lead.name}</p>
          <LeadCallStats lead={lead} compact className="mt-1" />
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.email || lead.phone || '—'}</span>
          </p>
          {lead.phone && lead.email && (
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{lead.phone}</p>
          )}
        </div>
        <div className="inline-flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-slate-500" />
            {adults} Adult{adults === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-slate-500" />
            {rooms} Room{rooms === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Tour Info */}
      <div className="space-y-2">
        <p className="text-[12px] text-slate-600">
          Going To:{' '}
          <span className="font-bold text-slate-900">{lead.destination || 'Not set'}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1 font-semibold">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatRange(lead.travelDate, lead.returnDate)}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Clock3 className="h-3.5 w-3.5" />
            {tourLabel(lead)}
          </span>
        </div>
        {tripLeft != null && (
          <span
            className={cn(
              'inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold text-white',
              tripLeft < 0 ? 'bg-slate-500' : tripLeft <= 7 ? 'bg-rose-500' : 'bg-amber-500'
            )}
          >
            {tripLeft < 0 ? `${Math.abs(tripLeft)} days ago` : `${tripLeft} days left`}
          </span>
        )}
      </div>

      {/* Payment Info */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-md border border-orange-300 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-700">
            ID: {bookingId}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', statusMeta.className)}>
            <Clock3 className="h-3 w-3" />
            {statusMeta.label}
          </span>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-500">Payment Progress</span>
            <span className="font-bold text-slate-900">
              {formatMoney(advance)} / {formatMoney(total)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full',
                progress >= 100 ? 'bg-emerald-500' : 'bg-amber-400'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-600">
            {balance > 0 ? (
              <>
                Next: <span className="font-bold text-slate-900">{formatMoney(balance)}</span>
                {payDue ? <> by {formatShortDate(payDue)}</> : null}
              </>
            ) : (
              <span className="font-semibold text-emerald-600">Fully paid</span>
            )}
          </p>
          {balance > 0 && payLeft != null && (
            <span className="inline-flex rounded-md border border-orange-300 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
              {payLeft < 0 ? 'Overdue' : `${payLeft} days left`}
            </span>
          )}
        </div>
        {detailHref && (
          <Link
            to={detailHref}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] font-bold text-violet-600 hover:underline"
          >
            Open booking →
          </Link>
        )}
      </div>
    </article>
  );
}

export default function ConvertedLeadsTable({
  leads = [],
  onRowClick,
  detailBasePath = '/leads',
  serverPagination = null,
}) {
  return (
    <TooltipProvider delayDuration={150}>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hidden border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 xl:grid xl:grid-cols-[220px_140px_minmax(200px,1.1fr)_minmax(220px,1.2fr)_minmax(240px,1.3fr)] xl:gap-4">
        <span>Booked On</span>
        <span>Source</span>
        <span>Guest Info</span>
        <span>Tour Info</span>
        <span>Payment Info</span>
      </div>

      {!leads.length ? (
        <div className="px-6 py-16 text-center text-sm text-slate-400">
          No converted leads yet
        </div>
      ) : (
        <div>
          {leads.map((lead) => (
            <ConvertedLeadRow
              key={lead._id}
              lead={lead}
              detailHref={`${detailBasePath}/${lead._id}${detailBasePath.includes('sales-executive') ? '/view' : ''}`}
              onClick={onRowClick}
            />
          ))}
        </div>
      )}

      {serverPagination && (
        <div className="border-t border-slate-100 px-3 py-2">
          <TablePagination
            pageIndex={serverPagination.pageIndex}
            pageSize={serverPagination.pageSize}
            pageCount={serverPagination.pageCount}
            total={serverPagination.total}
            hasMore={serverPagination.hasMore}
            onPageChange={(pageIndex) => {
              serverPagination.onPaginationChange?.((prev) => ({
                ...prev,
                pageIndex,
              }));
            }}
            onPageSizeChange={(pageSize) => {
              serverPagination.onPaginationChange?.((prev) => ({
                ...prev,
                pageSize,
                pageIndex: 0,
              }));
            }}
          />
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
