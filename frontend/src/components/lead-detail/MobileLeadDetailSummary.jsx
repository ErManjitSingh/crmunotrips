import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  FileText,
  IndianRupee,
  Luggage,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  StickyNote,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { beginLeadCall } from '../../lib/callSession';
import LeadCallStats from '../leads/LeadCallStats';

const STATUS_STYLES = {
  new: 'bg-violet-50 text-violet-600',
  contacted: 'bg-emerald-50 text-emerald-600',
  follow_up: 'bg-blue-50 text-blue-600',
  negotiation: 'bg-blue-50 text-blue-600',
  quotation_sent: 'bg-amber-50 text-amber-600',
  converted: 'bg-emerald-50 text-emerald-600',
  lost: 'bg-rose-50 text-rose-600',
};

function titleCase(value) {
  return String(value || 'New')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name) {
  return String(name || 'Lead')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatBudget(value) {
  if (!value) return 'Not Decided';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function formatTravelers(lead) {
  const adults = Number(lead?.adults ?? lead?.travelers ?? 0);
  const children = Number(lead?.children || 0);
  if (!adults && !children) return 'Not Decided';
  const parts = [];
  if (adults) parts.push(`${adults} Adult${adults === 1 ? '' : 's'}`);
  if (children) parts.push(`${children} Child${children === 1 ? '' : 'ren'}`);
  return parts.join(', ');
}

function dateValue(value) {
  if (!value) return null;
  if (typeof value === 'object') return value.scheduledAt || value.date || value.createdAt || null;
  return value;
}

function formatDate(value, fallback = 'Not Scheduled') {
  const raw = dateValue(value);
  if (!raw) return fallback;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OverviewCard({ icon: Icon, label, value, tone, decoration }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50/70 text-blue-500',
    orange: 'border-orange-100 bg-orange-50/70 text-orange-500',
    green: 'border-emerald-100 bg-emerald-50/70 text-emerald-500',
    violet: 'border-violet-100 bg-violet-50/70 text-violet-500',
  };
  return (
    <div className={`relative min-h-[82px] overflow-hidden rounded-xl border p-3 ${tones[tone]}`}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 text-[9px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] font-bold text-slate-900">{value}</p>
      <span className="pointer-events-none absolute -bottom-2 right-1 text-4xl opacity-10">{decoration}</span>
    </div>
  );
}

function ActionButton({ icon: Icon, label, tone, href, onClick }) {
  const className = `flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-semibold ${tone}`;
  if (href) return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={className}><Icon className="h-4 w-4" />{label}</a>;
  return <button type="button" onClick={onClick} className={className}><Icon className="h-4 w-4" />{label}</button>;
}

function Section({ icon: Icon, title, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-3.5 w-3.5" /></span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickAction({ icon: Icon, label, tone, onClick, to }) {
  const content = (
    <>
      <Icon className="h-5 w-5" />
      <span className="text-[9px] font-medium">{label}</span>
    </>
  );
  const className = `flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border ${tone}`;
  if (to) return <Link to={to} className={className}>{content}</Link>;
  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

export default function MobileLeadDetailSummary({
  lead,
  onAssign,
  onCreateQuote,
  onLogCallNote,
  editHref,
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const digits = String(lead.phone || '').replace(/\D/g, '');
  const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
  const assignedName = lead.assignedTo?.name;
  const travelDate = lead.travelDate
    ? new Date(lead.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Not Decided';
  const leadCode = lead.leadId || `LD-${String(lead._id || '').slice(-4).toUpperCase()}`;

  return (
    <div className="min-h-full bg-[#f7f7fb] pb-5 lg:hidden">
      <header className="relative min-h-[188px] overflow-hidden rounded-b-[22px] bg-gradient-to-br from-[#090b4d] via-[#17116a] to-[#30208f] px-5 pt-5 text-white">
        <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-[15px] font-bold">Lead Details</h1>
          <span className="rounded-lg bg-violet-500/35 px-2 py-1 text-[9px] font-semibold text-violet-100">{leadCode}</span>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white/10" aria-label="More actions">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-5 top-16 z-30 w-36 rounded-xl border border-white/10 bg-slate-900/95 p-1.5 text-[10px] shadow-xl">
            {editHref && <Link to={editHref} className="block rounded-lg px-3 py-2 hover:bg-white/10">Edit Lead</Link>}
            <Link to={`/leads/${lead._id}?view=full`} className="block rounded-lg px-3 py-2 hover:bg-white/10">Full Profile</Link>
          </div>
        )}
      </header>

      <main className="-mt-[96px] space-y-3 px-5">
        <section className="relative z-10 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_32px_rgba(27,20,92,0.14)]">
          <div className="flex items-center gap-3 p-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-bold text-white shadow-lg">
              {initials(lead.name)}
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-[15px] font-bold text-slate-900">{lead.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-600'}`}>☆ {titleCase(lead.status)} Lead</span>
                {lead.temperature && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-semibold uppercase text-blue-600">❄ {lead.temperature}</span>}
              </div>
              {lead.phone && <p className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-500"><Phone className="h-3 w-3" />{lead.phone}</p>}
              {lead.email && <p className="mt-1 flex items-center gap-1.5 truncate text-[9px] text-slate-500"><Mail className="h-3 w-3" />{lead.email}</p>}
            </div>
            {lead.phone && (
              <button
                type="button"
                onClick={() => beginLeadCall({ leadId: lead._id, leadName: lead.name, phone: lead.phone })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-600"
              >
                <Phone className="h-5 w-5" />
              </button>
            )}
          </div>
          <div className="px-4 pb-2">
            <LeadCallStats lead={lead} />
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-2.5">
            <ActionButton icon={MessageCircle} label="WhatsApp" href={whatsappNumber ? `https://wa.me/${whatsappNumber}` : undefined} tone="border-emerald-100 bg-emerald-50 text-emerald-600" />
            <ActionButton
              icon={Phone}
              label="Call"
              onClick={() => beginLeadCall({ leadId: lead._id, leadName: lead.name, phone: lead.phone })}
              tone="border-blue-100 bg-blue-50 text-blue-600"
            />
            <ActionButton icon={Mail} label="Email" href={lead.email ? `mailto:${lead.email}` : undefined} tone="border-violet-100 bg-violet-50 text-violet-600" />
            <ActionButton icon={MoreHorizontal} label="More" onClick={() => setMenuOpen((open) => !open)} tone="border-slate-200 bg-white text-slate-600" />
          </div>
        </section>

        <Section
          icon={Luggage}
          title="Travel Overview"
          action={editHref ? <Link to={editHref} className="inline-flex items-center gap-1 text-[9px] font-semibold text-violet-600"><Pencil className="h-3 w-3" />Edit</Link> : null}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <OverviewCard icon={MapPin} label="Destination" value={lead.destination || 'Not Decided'} tone="blue" decoration="⛰" />
            <OverviewCard icon={CalendarDays} label="Travel Date" value={travelDate} tone="orange" decoration="▦" />
            <OverviewCard icon={IndianRupee} label="Budget" value={formatBudget(lead.budget)} tone="green" decoration="₹" />
            <OverviewCard icon={Users} label="Travelers" value={formatTravelers(lead)} tone="violet" decoration="●" />
          </div>
        </Section>

        <Section
          icon={UserPlus}
          title="Assigned To"
          action={onAssign ? <button type="button" onClick={() => onAssign(lead)} className="text-[9px] font-semibold text-violet-600">Change</button> : null}
        >
          <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/80 to-blue-50/60 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white">
              {initials(assignedName || 'Unassigned')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-slate-900">{assignedName || 'Unassigned'}</p>
              <p className="text-[9px] text-slate-500">{lead.assigneeRole ? titleCase(lead.assigneeRole) : 'Travel Consultant'}</p>
            </div>
            {onAssign && <button type="button" onClick={() => onAssign(lead)} className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-2 text-[9px] font-semibold text-white shadow-md"><UserPlus className="h-3.5 w-3.5" />{assignedName ? 'Reassign' : 'Assign Now'}</button>}
          </div>
        </Section>

        <Section icon={CalendarDays} title="Follow Ups">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
              <p className="flex items-center gap-1.5 text-[9px] font-semibold text-blue-600"><CalendarDays className="h-3.5 w-3.5" />Next Follow-up</p>
              <p className="mt-2 min-h-[25px] text-[8px] text-slate-500">{formatDate(lead.nextFollowUp)}</p>
              <Link to="/followups" className="mt-2 flex h-8 items-center justify-center rounded-lg border border-blue-200 text-[9px] font-semibold text-blue-600">+ Schedule Now</Link>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
              <p className="flex items-center gap-1.5 text-[9px] font-semibold text-rose-600"><CalendarDays className="h-3.5 w-3.5" />Last Follow-up</p>
              <p className="mt-2 min-h-[25px] text-[8px] text-slate-500">{formatDate(lead.lastFollowUp, 'Not Available')}</p>
              <Link to="/followups" className="mt-2 flex h-8 items-center justify-center rounded-lg border border-rose-200 text-[9px] font-semibold text-rose-600">Add Follow-up</Link>
            </div>
          </div>
        </Section>

        <Section icon={Zap} title="Quick Actions">
          <div className="flex gap-2.5">
            <QuickAction icon={UserPlus} label="Assign Lead" tone="border-violet-100 bg-violet-50 text-violet-600" onClick={() => onAssign?.(lead)} />
            <QuickAction icon={FileText} label="Create Quote" tone="border-blue-100 bg-blue-50 text-blue-600" onClick={onCreateQuote} />
            <QuickAction icon={CalendarPlus} label="Add Follow-up" tone="border-emerald-100 bg-emerald-50 text-emerald-600" to="/followups" />
            <QuickAction icon={StickyNote} label="Add Note" tone="border-orange-100 bg-orange-50 text-orange-600" onClick={onLogCallNote} />
          </div>
        </Section>

        <div className="grid grid-cols-2 gap-3 pb-2">
          <Link to={`/leads/${lead._id}?view=full`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[10px] font-semibold text-white shadow-lg shadow-violet-500/20">
            <UserPlus className="h-4 w-4" />Full Profile
          </Link>
          {editHref ? (
            <Link to={editHref} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[10px] font-semibold text-blue-600 shadow-sm">
              <Pencil className="h-4 w-4" />Edit Lead
            </Link>
          ) : <div />}
        </div>
      </main>
    </div>
  );
}
