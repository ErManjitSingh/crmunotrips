import { X, Mail, MapPin, Globe, Calendar, Wallet, User, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import WhatsAppQuickActions from './WhatsAppQuickActions';
import WhatsAppNotesTimeline from './WhatsAppNotesTimeline';
import WhatsAppFollowUpPanel from './WhatsAppFollowUpPanel';
import { formatBudget, formatTravelDate, getInitials } from './whatsappUtils';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon className="w-3.5 h-3.5 text-wa-text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-wa-text-muted">{label}</p>
        <p className="text-xs text-wa-text-primary truncate">{value || '—'}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-wa-text-muted">{title}</h4>
      <div className="rounded-xl bg-wa-input/40 border border-wa-border/50 p-3 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

export default function WhatsAppLeadInfoPanel({
  lead,
  contact,
  notes,
  followups,
  onClose,
  onAction,
  onCreateLead,
  creatingLead,
  className,
}) {
  if (!lead && !contact) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full bg-wa-panel border-l border-wa-border p-6 text-center', className)}>
        <p className="text-sm text-wa-text-muted">Select a chat to view details</p>
      </div>
    );
  }

  if (!lead && contact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn('flex flex-col h-full bg-wa-panel/95 backdrop-blur-xl border-l border-wa-border', className)}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-wa-border bg-wa-header/80">
          <h3 className="font-semibold text-wa-text-primary text-sm">New WhatsApp Chat</h3>
          {onClose && (
            <button type="button" onClick={onClose} className="xl:hidden p-1.5 rounded-lg hover:bg-wa-list-hover text-wa-text-muted">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center pb-4 border-b border-wa-border/50">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg mb-3">
              {getInitials(contact.profileName || contact.phone)}
            </div>
            <h3 className="font-bold text-wa-text-primary">{contact.profileName || 'WhatsApp User'}</h3>
            <p className="text-xs text-wa-text-muted mt-1">{contact.phone}</p>
          </div>
          <p className="text-sm text-wa-text-secondary">
            Ye chat abhi lead nahi hai. Create Lead dabao — CRM me WhatsApp source ke saath lead ban jayegi.
          </p>
          {onCreateLead && (
            <button
              type="button"
              onClick={onCreateLead}
              disabled={creatingLead}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60"
            >
              {creatingLead ? 'Creating…' : 'Create Lead'}
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('flex flex-col h-full bg-wa-panel/95 backdrop-blur-xl border-l border-wa-border', className)}
    >
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-wa-border bg-wa-header/80">
        <h3 className="font-semibold text-wa-text-primary text-sm">Lead Information</h3>
        {onClose && (
          <button type="button" onClick={onClose} className="xl:hidden p-1.5 rounded-lg hover:bg-wa-list-hover text-wa-text-muted">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="flex flex-col items-center text-center pb-4 border-b border-wa-border/50">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold text-xl shadow-lg mb-3">
            {getInitials(lead.name)}
          </div>
          <h3 className="font-bold text-wa-text-primary">{lead.name}</h3>
          <div className="mt-2">
            <LeadStatusBadge status={lead.status} />
          </div>
        </div>

        <Section title="Customer Details">
          <InfoRow icon={User} label="Phone" value={lead.phone} />
          <InfoRow icon={Mail} label="Email" value={lead.email} />
          <InfoRow icon={MapPin} label="City" value={lead.city} />
        </Section>

        <Section title="Travel Details">
          <InfoRow icon={Globe} label="Destination" value={lead.destination} />
          <InfoRow icon={Calendar} label="Travel Date" value={formatTravelDate(lead.travelDate)} />
          <InfoRow icon={Wallet} label="Budget" value={formatBudget(lead.budget)} />
        </Section>

        <Section title="Lead Details">
          <InfoRow icon={Tag} label="Lead Source" value={lead.sourceLabel || 'WhatsApp'} />
          <InfoRow icon={User} label="Assigned Executive" value={lead.assignedTo?.name} />
        </Section>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-wa-text-muted mb-2">Quick Actions</h4>
          <WhatsAppQuickActions lead={lead} onAction={onAction} />
        </div>

        <WhatsAppFollowUpPanel lead={lead} followups={followups} />
        <WhatsAppNotesTimeline notes={notes} onAddNote={() => onAction('note')} />
      </div>
    </motion.div>
  );
}
