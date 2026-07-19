import { ArrowLeft, Phone, Info, UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import { getInitials } from './whatsappUtils';

export default function WhatsAppConversationHeader({
  lead,
  contact,
  onBack,
  onToggleInfo,
  showInfoToggle,
  onCreateLead,
  creatingLead,
}) {
  const name = lead?.name || contact?.profileName || `+91 ${contact?.phone || ''}`;
  const phone = lead?.phone || contact?.phone || '';

  if (!lead && !contact) return null;

  return (
    <div className="shrink-0 flex items-center gap-3 px-3 py-2.5 bg-wa-header/90 backdrop-blur-md border-b border-wa-border">
      <button
        type="button"
        onClick={onBack}
        className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-wa-list-hover text-wa-text-secondary"
        aria-label="Back to list"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
        {getInitials(name)}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-wa-text-primary truncate">{name}</h3>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-wa-text-muted truncate">{phone}</span>
          {lead ? (
            <LeadStatusBadge status={lead.status} size="sm" />
          ) : (
            <span className="text-[10px] text-amber-600 font-medium">Not a lead yet</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!lead && onCreateLead && (
          <button
            type="button"
            onClick={onCreateLead}
            disabled={creatingLead}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {creatingLead ? 'Creating…' : 'Create Lead'}
          </button>
        )}
        {lead?.assignedTo && (
          <span className="hidden sm:inline text-[10px] text-wa-text-muted bg-wa-input px-2 py-1 rounded-full mr-1">
            {lead.assignedTo.name}
          </span>
        )}
        {phone && (
          <a
            href={`tel:${phone}`}
            className="p-2 rounded-lg hover:bg-wa-list-hover text-wa-text-secondary transition-colors"
            aria-label="Call"
          >
            <Phone className="w-5 h-5" />
          </a>
        )}
        {showInfoToggle && lead && (
          <button
            type="button"
            onClick={onToggleInfo}
            className={cn('xl:hidden p-2 rounded-lg hover:bg-wa-list-hover text-wa-text-secondary transition-colors')}
            aria-label="Lead info"
          >
            <Info className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
