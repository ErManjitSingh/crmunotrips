import { Link, useNavigate } from 'react-router-dom';
import { Phone, MapPin, Flame, Pencil, ChevronRight } from 'lucide-react';
import { formatLeadId } from '../leads/constants';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import { LeadListStatusIcon } from '../sales-manager/LeadListBadges';
import Avatar from '../ui/Avatar';
import { normalizeLeadStatus } from '../../utils/leadUtils';
import {
  getInitials,
  formatSource,
  computeLeadScores,
  DETAIL_CARD,
} from './leadDetailUtils';
import { cn } from '../../lib/utils';

function formatTravelRange(lead) {
  const start = lead?.travelDate || lead?.travelStartDate;
  const end = lead?.returnDate || lead?.travelEndDate;
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return fmt(start);
  return '—';
}

function formatBudget(lead) {
  if (lead?.budgetRange && lead.budgetRange !== 'custom') {
    const map = {
      under_20000: 'Under ₹20,000',
      '20000_40000': '₹20,000 - ₹40,000',
      '40000_60000': '₹40,000 - ₹60,000',
      '60000_100000': '₹60,000 - ₹1,00,000',
      above_100000: 'Above ₹1,00,000',
    };
    return map[lead.budgetRange] || String(lead.budgetRange).replace(/_/g, ' ');
  }
  if (lead?.budget) return `₹${Number(lead.budget).toLocaleString('en-IN')}`;
  return '—';
}

function formatTravelers(lead) {
  const adults = lead.adults ?? Math.max(1, (lead.travelers || 2) - (lead.children || 0));
  const children = lead.children ?? 0;
  const a = `${adults} Adult${adults === 1 ? '' : 's'}`;
  const c = children > 0 ? `, ${children} Child${children === 1 ? '' : 'ren'}` : '';
  return `${a}${c}`;
}

function formatRelativeActivity(lead) {
  const raw = lead.lastContactedAt || lead.updatedAt || lead.lastActivityAt;
  if (!raw) return '—';
  const ms = Date.now() - new Date(raw).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function ContactChip({ icon: Icon, children, href }) {
  const Comp = href ? 'a' : 'div';
  return (
    <Comp
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm',
        href && 'transition-colors hover:border-violet-300 hover:text-violet-700',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-violet-500" />
      <span className="truncate font-medium">{children}</span>
    </Comp>
  );
}

function OverviewRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="shrink-0 text-[13px] text-slate-500">{label}</span>
      <span className={cn('text-right text-[13px] font-semibold text-slate-900', valueClass)}>{value}</span>
    </div>
  );
}

export default function MobileLeadDetailSummary({
  lead,
  editHref,
}) {
  const navigate = useNavigate();
  const status = normalizeLeadStatus(lead.status);
  const scores = computeLeadScores(lead);
  const temperature = lead.isHot || lead.temperature === 'hot'
    ? 'Hot'
    : (lead.temperature || 'Warm');
  const tempCapitalized = temperature.charAt(0).toUpperCase() + temperature.slice(1);
  const scorePct = Math.max(0, Math.min(100, Number(scores.overall) || 0));
  const location =
    [lead.city, lead.state].filter(Boolean).join(', ') || lead.destination || 'India';
  const fullProfileHref = `/leads/${lead._id}?view=full`;

  return (
    <div className="min-h-full bg-[#f4f5f7] px-4 pb-28 pt-4 lg:hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to Leads
        </button>
        {editHref ? (
          <Link
            to={editHref}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
          >
            Edit Lead
            <ChevronRight className="h-4 w-4 opacity-80" />
          </Link>
        ) : null}
      </div>

      <div className={cn(DETAIL_CARD, 'overflow-hidden')}>
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md',
                'bg-gradient-to-br from-violet-500 to-indigo-600',
              )}
            >
              {getInitials(lead.name)}
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {lead.name}
                </h1>
                <LeadStatusBadge status={status} reason={lead.statusReason} lead={lead} pulse={status === 'new'} size="sm" />
              </div>
              <p className="text-sm text-slate-500">
                {formatLeadId(lead._id || lead.leadId)} · Lead 360 · {lead.destination || '—'}
              </p>
              <div className="mt-1.5">
                <LeadListStatusIcon lead={lead} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {lead.phone ? (
              <ContactChip icon={Phone} href={`tel:${lead.phone}`}>{lead.phone}</ContactChip>
            ) : null}
            <ContactChip icon={MapPin}>{location}</ContactChip>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Source</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatSource(lead)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Created On</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {lead.createdAt
                  ? new Date(lead.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last Activity</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{formatRelativeActivity(lead)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assigned To</p>
              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                {lead.assignedTo?.name ? (
                  <>
                    <Avatar name={lead.assignedTo.name} size="sm" className="!h-6 !w-6 ring-2 ring-violet-200" />
                    <span className="truncate text-sm font-semibold text-slate-800">{lead.assignedTo.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Unassigned</span>
                )}
                <span className="rounded p-0.5 text-slate-400" aria-hidden>
                  <Pencil className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="border-b border-slate-200/80 pb-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] text-slate-500">Lead Score</span>
                <span className="text-sm font-bold text-emerald-600">{scores.overall}/100</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                  style={{ width: `${scorePct}%` }}
                />
              </div>
            </div>

            <OverviewRow
              label="Lead Temperature"
              value={(
                <span className="inline-flex items-center gap-1 text-orange-600">
                  <Flame className="h-3.5 w-3.5" /> {tempCapitalized}
                </span>
              )}
            />
            <OverviewRow label="Travel Date" value={formatTravelRange(lead)} />
            <OverviewRow label="Travelers" value={formatTravelers(lead)} />
            <OverviewRow label="Meal Plan" value={(lead?.mealPlan || lead?.mealPreference || 'map').toString().toUpperCase()} valueClass="text-violet-700" />

            <Link
              to={fullProfileHref}
              className="mt-3 inline-flex w-full items-center justify-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-500"
            >
              View Full Details
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
