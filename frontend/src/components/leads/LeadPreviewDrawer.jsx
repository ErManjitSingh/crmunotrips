import { forwardRef } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  IndianRupee,
  Users,
  Pencil,
  UserPlus,
  ExternalLink,
  MessageCircle,
  Clock,
  Sparkles,
  MoreHorizontal,
  Eye,
  UserCheck,
  RefreshCw,
  Trash2,
  Luggage,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { openCrmWhatsApp } from '../../lib/openCrmWhatsApp';
import LeadStatusBadge from './LeadStatusBadge';
import Avatar from '../ui/Avatar';
import AppDrawer from '../ui/AppDrawer';
import { formatLeadId } from './constants';
import { cn } from '../../lib/utils';
import RepeatedLeadBadge from './RepeatedLeadBadge';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

function assigneeLabel(lead) {
  if (lead?.assigneeRole === 'sales_manager') return 'Sales Manager';
  if (lead?.assigneeRole === 'team_leader') return 'Team Leader';
  if (lead?.assignedManager?.name && lead.assignedTo?.name === lead.assignedManager.name) return 'Sales Manager';
  if (lead?.assignedTeamLeader?.name && lead.assignedTo?.name === lead.assignedTeamLeader.name) return 'Team Leader';
  return 'Travel Consultant';
}

function formatBudget(amount) {
  if (!amount) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function formatTravelers(lead) {
  const count = lead?.travelers ?? lead?.adults;
  if (!count) return '—';
  const children = lead?.children ?? 0;
  if (children > 0) return `${count} (${children} child${children > 1 ? 'ren' : ''})`;
  return String(count);
}

function splitDateTime(value) {
  if (!value) return { date: '—', time: '' };
  const d = new Date(value);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function OverviewCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'bg-blue-50 border-blue-100',
    orange: 'bg-orange-50 border-orange-100',
    green: 'bg-emerald-50 border-emerald-100',
    purple: 'bg-violet-50 border-violet-100',
  };
  const iconTones = {
    blue: 'text-blue-500',
    orange: 'text-orange-500',
    green: 'text-emerald-500',
    purple: 'text-violet-500',
  };
  return (
    <div className={cn('rounded-xl border p-3.5', tones[tone])}>
      <Icon className={cn('w-5 h-5 mb-2', iconTones[tone])} strokeWidth={2} />
      <p className="text-[11px] text-slate-500 font-medium">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5 break-words">{value || '—'}</p>
    </div>
  );
}

const ContactBtn = forwardRef(function ContactBtn(
  { href, icon: Icon, label, tone, target, rel, onClick, type = 'button', ...props },
  ref
) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100/80',
    green: 'border-green-100 bg-green-50 text-green-600 hover:bg-green-100/80',
    purple: 'border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-100/80',
    grey: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
  };
  const cls = cn(
    'flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 transition-colors min-w-0',
    tones[tone]
  );
  const inner = (
    <>
      <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
      <span className="text-xs font-semibold">{label}</span>
    </>
  );
  if (href) {
    return (
      <a ref={ref} href={href} target={target} rel={rel} className={cls} onClick={onClick} {...props}>
        {inner}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={cls} onClick={onClick} {...props}>
      {inner}
    </button>
  );
});

function SectionTitle({ icon: Icon, children, action }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-800">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" strokeWidth={2.25} />}
        {children}
      </h3>
      {action}
    </div>
  );
}

export default function LeadPreviewDrawer({
  lead,
  onClose,
  onAssign,
  onDelete,
  onTransferBranch,
  canEditLead = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const nextFu = splitDateTime(lead?.nextFollowUp);
  const lastFu = splitDateTime(lead?.lastFollowUp);
  const assignedName = lead?.assignedTo?.name;

  return (
    <AppDrawer open={!!lead} onClose={onClose} className="max-w-[400px] border-l border-slate-200 bg-white shadow-2xl">
      {lead && (
        <>
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                    {lead.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'LD'}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white ring-2 ring-white shadow-sm">
                    <Sparkles className="w-3 h-3" />
                  </span>
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-semibold text-blue-600">{formatLeadId(lead._id)}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <LeadStatusBadge
                      status={lead.status}
                      reason={lead.statusReason}
                      lead={lead}
                      pulse={lead.status === 'new'}
                      size="sm"
                    />
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-900 leading-tight break-words">{lead.name}</h2>
                  {(lead.isRepeatCustomer || lead.isVip) && (
                    <div className="mt-2">
                      <RepeatedLeadBadge size="md" />
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              {lead.phone && (
                <ContactBtn href={`tel:${lead.phone}`} icon={Phone} label="Call" tone="blue" />
              )}
              {lead.phone && (
                <ContactBtn
                  icon={MessageCircle}
                  label="WhatsApp"
                  tone="green"
                  onClick={() =>
                    openCrmWhatsApp({
                      leadId: lead._id,
                      phone: lead.phone,
                      navigate,
                      role: user?.role,
                      toast,
                    })
                  }
                />
              )}
              {lead.email && (
                <ContactBtn href={`mailto:${lead.email}`} icon={Mail} label="Email" tone="purple" />
              )}
              <DropdownMenuRoot>
                <DropdownMenuTrigger asChild>
                  <ContactBtn icon={MoreHorizontal} label="More" tone="grey" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-xl">
                  <DropdownMenuItem asChild>
                    <Link to={`/leads/${lead._id}`} className="gap-2 rounded-lg cursor-pointer">
                      <Eye className="w-4 h-4" /> View Full Profile
                    </Link>
                  </DropdownMenuItem>
                  {canEditLead && (
                    <DropdownMenuItem asChild>
                      <Link to={`/leads/${lead._id}/edit`} className="gap-2 rounded-lg cursor-pointer">
                        <Pencil className="w-4 h-4" /> Edit Lead
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {onAssign && (
                    <DropdownMenuItem onClick={() => onAssign(lead)} className="gap-2 rounded-lg cursor-pointer">
                      <UserCheck className="w-4 h-4" />
                      {assignedName ? 'Reassign Lead' : 'Assign Lead'}
                    </DropdownMenuItem>
                  )}
                  {onTransferBranch && (
                    <DropdownMenuItem onClick={() => onTransferBranch(lead)} className="gap-2 rounded-lg cursor-pointer">
                      <RefreshCw className="w-4 h-4" /> Transfer Branch
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDelete(lead._id)}
                        className="gap-2 rounded-lg cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Lead
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenuRoot>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <section>
              <SectionTitle icon={Luggage}>Travel Overview</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <OverviewCard icon={MapPin} label="Destination" value={lead.destination} tone="blue" />
                <OverviewCard
                  icon={Calendar}
                  label="Travel Date"
                  value={
                    lead.travelDate
                      ? new Date(lead.travelDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : null
                  }
                  tone="orange"
                />
                <OverviewCard icon={IndianRupee} label="Budget" value={formatBudget(lead.budget)} tone="green" />
                <OverviewCard icon={Users} label="Travelers" value={formatTravelers(lead)} tone="purple" />
              </div>
            </section>

            <section>
              <SectionTitle
                action={
                  onAssign ? (
                    <button
                      type="button"
                      onClick={() => onAssign(lead)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Assign
                    </button>
                  ) : null
                }
              >
                Assigned To
              </SectionTitle>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-4',
                  assignedName
                    ? 'border-emerald-100 bg-emerald-50/60'
                    : 'border-orange-100 bg-orange-50/50'
                )}
              >
                <Avatar
                  name={assignedName || 'Unassigned'}
                  size="md"
                  className={cn('!w-10 !h-10 shrink-0', assignedName ? 'ring-2 ring-blue-200' : 'ring-2 ring-orange-200')}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{assignedName || 'Unassigned'}</p>
                  <p className="text-xs text-slate-500">{assigneeLabel(lead)}</p>
                </div>
                {!assignedName && onAssign && (
                  <button
                    type="button"
                    onClick={() => onAssign(lead)}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-500/25 hover:brightness-110 transition-all"
                  >
                    Assign now
                  </button>
                )}
              </div>
            </section>

            <section>
              <SectionTitle>Follow Ups</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                  <div className="flex items-center gap-1.5 text-blue-600 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[11px] font-semibold">Next Follow-up</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{nextFu.date}</p>
                  {nextFu.time && <p className="text-xs text-slate-500 mt-0.5">{nextFu.time}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <div className="flex items-center gap-1.5 text-red-500 mb-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-[11px] font-semibold">Last Follow-up</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{lastFu.date}</p>
                  {lastFu.time && <p className="text-xs text-slate-500 mt-0.5">{lastFu.time}</p>}
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>Quick Actions</SectionTitle>
              <div className="space-y-2.5">
                {onAssign && (
                  <button
                    type="button"
                    onClick={() => onAssign(lead)}
                    className="flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-sm font-semibold text-white shadow-md shadow-violet-500/20 hover:brightness-110 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    {assignedName ? 'Reassign Lead' : 'Assign Lead'}
                  </button>
                )}
                <div className={cn('grid gap-2.5', canEditLead ? 'grid-cols-2' : 'grid-cols-1')}>
                  <Link
                    to={`/leads/${lead._id}`}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Full Profile
                  </Link>
                  {canEditLead && (
                    <Link
                      to={`/leads/${lead._id}/edit`}
                      className="flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 text-sm font-semibold text-white transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Lead
                    </Link>
                  )}
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </AppDrawer>
  );
}
