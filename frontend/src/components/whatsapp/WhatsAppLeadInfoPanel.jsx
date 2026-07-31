import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Mail,
  MapPin,
  Globe,
  Calendar,
  Wallet,
  User,
  Users,
  Phone,
  StickyNote,
  CalendarClock,
  MoreHorizontal,
  MessageCircle,
  FolderOpen,
  Activity,
  Zap,
  ArrowRight,
  Tag,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import WhatsAppNotesTimeline from './WhatsAppNotesTimeline';
import WhatsAppFollowUpPanel from './WhatsAppFollowUpPanel';
import { INFO_TABS } from './constants';
import {
  formatBudget,
  formatTravelDate,
  getInitials,
  formatWhatsAppPhone,
  resolveWhatsAppDisplayName,
} from './whatsappUtils';

function InfoRow({ icon: Icon, label, value, iconTone }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          iconTone || 'bg-violet-50 text-violet-500'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
        <p className="text-[13px] text-slate-800 truncate font-medium">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-violet-600/80 px-0.5">
        {title}
      </h4>
      <div className="rounded-xl border border-slate-100 bg-white px-3 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {children}
      </div>
    </div>
  );
}

function BotAnswersBlock({ botAnswers }) {
  if (!botAnswers) return null;
  const hasDate = botAnswers.travelDate || botAnswers.travelDateRaw;
  const hasTravelers = botAnswers.travelers != null && botAnswers.travelers !== '';
  if (!hasDate && !hasTravelers) return null;
  return (
    <Section title="Auto collected">
      <InfoRow
        icon={Calendar}
        label="Kab jana hai"
        value={
          botAnswers.travelDate
            ? formatTravelDate(botAnswers.travelDate)
            : botAnswers.travelDateRaw || '—'
        }
      />
      <InfoRow
        icon={Users}
        label="Travelers"
        value={hasTravelers ? String(botAnswers.travelers) : '—'}
      />
    </Section>
  );
}

const QUICK_ACTIONS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tone: 'text-emerald-600 bg-emerald-50' },
  { key: 'call', label: 'Call', icon: Phone, tone: 'text-sky-600 bg-sky-50' },
  { key: 'note', label: 'Note', icon: StickyNote, tone: 'text-amber-600 bg-amber-50' },
  { key: 'followup', label: 'Follow Up', icon: CalendarClock, tone: 'text-violet-600 bg-violet-50' },
  { key: 'more', label: 'More', icon: MoreHorizontal, tone: 'text-slate-600 bg-slate-50' },
];

export default function WhatsAppLeadInfoPanel({
  lead,
  contact,
  notes,
  followups,
  onClose,
  onAction,
  onCreateLead,
  creatingLead,
  canAssign = true,
  className,
}) {
  const [tab, setTab] = useState('details');
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const botAnswers = contact?.botAnswers || null;
  const name = resolveWhatsAppDisplayName(contact || {}, lead);
  const phone = formatWhatsAppPhone(contact?.waId || contact?.phone || lead?.phone);
  const travelDate = lead?.travelDate || botAnswers?.travelDate || null;
  const travelDateLabel = travelDate
    ? formatTravelDate(travelDate)
    : botAnswers?.travelDateRaw || null;
  const travelers = lead?.travelers || lead?.adults || botAnswers?.travelers || null;
  const sourceLabel = lead?.sourceLabel || lead?.source || 'WhatsApp';

  if (!lead && !contact) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full bg-white border-l border-slate-200/80 p-6 text-center', className)}>
        <p className="text-sm text-slate-400">Select a chat to view details</p>
      </div>
    );
  }

  const handleQuick = (key) => {
    if (key === 'whatsapp') return;
    if (key === 'more') {
      setShowMore((v) => !v);
      return;
    }
    onAction?.(key);
  };

  const handleViewFull = () => {
    if (!lead?._id) return;
    const isExecutive = user?.role === 'sales_executive';
    navigate(isExecutive ? `/sales-executive/leads/${lead._id}/view` : `/leads/${lead._id}`);
  };

  return (
    <div className={cn('flex flex-col h-full bg-white border-l border-slate-200/80', className)}>
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-sm">Lead Information</h3>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="xl:hidden p-1.5 rounded-lg hover:bg-slate-50 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-500 p-5 text-center text-white shadow-lg shadow-violet-500/25">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-xl border-2 border-white/30 mb-3">
            {getInitials(name)}
          </div>
          <h3 className="font-bold text-lg leading-tight">{name}</h3>
          <p className="text-sm text-white/85 mt-1 tabular-nums inline-flex items-center gap-1.5 justify-center">
            <MessageCircle className="w-3.5 h-3.5" />
            {phone}
          </p>
          <div className="mt-3 flex justify-center">
            {lead ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/20 border border-white/25">
                {lead.status === 'new' ? 'New Lead' : String(lead.status || '').replace(/_/g, ' ')}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/30 border border-white/20">
                New chat
              </span>
            )}
          </div>
        </div>

        {!lead && onCreateLead && (
          <button
            type="button"
            onClick={onCreateLead}
            disabled={creatingLead}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-semibold hover:from-violet-700 hover:to-violet-600 disabled:opacity-60 shadow-md shadow-violet-500/30 inline-flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 fill-current" />
            {creatingLead ? 'Creating…' : 'Create Lead'}
          </button>
        )}

        {lead && (
          <>
            <div className="grid grid-cols-5 gap-1">
              {QUICK_ACTIONS.map(({ key, label, icon: Icon, tone }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleQuick(key)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105', tone)}>
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">{label}</span>
                </button>
              ))}
            </div>

            {showMore && (
              <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                <button
                  type="button"
                  onClick={() => onAction?.('quotation')}
                  className="text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
                >
                  Quotation
                </button>
                <button
                  type="button"
                  onClick={() => onAction?.('status')}
                  className="text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
                >
                  Lead status
                </button>
                {canAssign && (
                  <button
                    type="button"
                    onClick={() => onAction?.('assign')}
                    className="text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 col-span-2"
                  >
                    Assign Lead
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-slate-100 pb-px">
          {INFO_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'shrink-0 px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'text-violet-600 border-violet-600'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'details' && (
          <div className="space-y-4">
            <Section title="Customer Details">
              <InfoRow icon={Phone} label="WhatsApp" value={phone} />
              <InfoRow icon={User} label="CRM Lead" value={lead?.name || name} />
              <InfoRow icon={Mail} label="Email" value={lead?.email} />
              <InfoRow icon={MapPin} label="City" value={lead?.city} />
              <InfoRow icon={Tag} label="Source" value={sourceLabel} />
              <InfoRow
                icon={Wallet}
                label="Budget"
                value={lead ? formatBudget(lead.budget) : null}
              />
            </Section>
            <BotAnswersBlock botAnswers={botAnswers} />
            {lead && (
              <Section title="Assignment">
                <InfoRow icon={User} label="Assigned Executive" value={lead.assignedTo?.name} />
                <div className="py-2 px-1">
                  <LeadStatusBadge status={lead.status} />
                </div>
              </Section>
            )}
          </div>
        )}

        {tab === 'travel' && (
          <div className="space-y-4">
            <Section title="Travel Details">
              <InfoRow icon={Globe} label="Destination" value={lead?.destination} />
              <InfoRow icon={Calendar} label="Travel Date" value={travelDateLabel} />
              <InfoRow icon={Users} label="Travelers" value={travelers != null ? String(travelers) : null} />
              <InfoRow icon={Wallet} label="Budget" value={lead ? formatBudget(lead.budget) : null} />
            </Section>
            <BotAnswersBlock botAnswers={botAnswers} />
          </div>
        )}

        {tab === 'notes' && (
          lead ? (
            <WhatsAppNotesTimeline notes={notes || []} onAddNote={() => onAction?.('note')} />
          ) : (
            <p className="text-xs text-slate-400 italic">Create a lead to add notes.</p>
          )
        )}

        {tab === 'activity' && (
          lead ? (
            <WhatsAppFollowUpPanel lead={lead} followups={followups || []} />
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No activity yet</p>
            </div>
          )
        )}

        {tab === 'files' && (
          <div className="text-center py-10 text-slate-400">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No files attached</p>
          </div>
        )}
      </div>

      {lead?._id && (
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={handleViewFull}
            className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            View Full Details
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
