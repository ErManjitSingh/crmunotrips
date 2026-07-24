import { useState } from 'react';
import { Phone, FileText, CalendarPlus, MoreHorizontal, MessageCircle, Mail } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import WhatsAppActionButton from './WhatsAppActionButton';
import EmailComposerModal from '../email/EmailComposerModal';
import ActionTile from '../ui/ActionTile';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';
import { DETAIL_CARD } from '../lead-detail/leadDetailUtils';
import { toast } from '../../context/ToastContext';
import { beginLeadCall } from '../../lib/callSession';

export default function LeadContactActions({
  lead,
  leadId,
  contactEndpoint = '/leads',
  onCreateQuote,
  onScheduleFollowUp,
  onContactLogged,
  onEmailSent,
  onChangeStatus,
  onLogCallNote,
  className = '',
}) {
  const { can } = usePermissions();
  const canUseWhatsApp = can('whatsapp', 'use');
  const canSendEmail = can('email', 'send');
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  const phone = lead?.whatsapp || lead?.phone;
  const email = lead?.email;

  const handleCall = () => {
    if (!phone) {
      toast.error('Lead phone number is missing');
      return;
    }
    beginLeadCall({
      leadId: leadId || lead?._id,
      leadName: lead?.name,
      phone,
    });
  };

  const handleWhatsApp = () => {
    if (!phone) {
      toast.error('Lead phone number is missing');
      return;
    }
    setWaOpen(true);
  };

  const handleEmail = () => {
    if (!email) {
      toast.info('Lead has no email — you can type one in the composer');
    }
    setEmailOpen(true);
  };

  return (
    <div className={`${DETAIL_CARD} p-4 sm:p-5 mb-6 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Call, WhatsApp, or email this lead in one tap</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <ActionTile
          icon={Phone}
          label="Call"
          description="Make a call"
          tone="emerald"
          disabled={!phone}
          onClick={handleCall}
          title={phone ? `Call ${phone}` : 'No phone on lead'}
        />

        {canUseWhatsApp ? (
          <ActionTile
            icon={MessageCircle}
            label="WhatsApp"
            description="Send WhatsApp"
            tone="green"
            disabled={!phone}
            onClick={handleWhatsApp}
            title={phone ? `WhatsApp ${phone}` : 'No phone on lead'}
          />
        ) : null}

        {canSendEmail ? (
          <ActionTile
            icon={Mail}
            label="Send Email"
            description="Send an email"
            tone="sky"
            onClick={handleEmail}
            title={email || 'Compose email'}
          />
        ) : null}

        {onCreateQuote ? (
          <ActionTile
            icon={FileText}
            label="Create Quotation"
            description="Build a package"
            tone="violet"
            onClick={onCreateQuote}
          />
        ) : null}

        {onScheduleFollowUp ? (
          <ActionTile
            icon={CalendarPlus}
            label="Schedule Follow-up"
            description="Set a reminder"
            tone="amber"
            onClick={onScheduleFollowUp}
          />
        ) : null}

        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 hover:border-slate-300 px-4 py-3.5 text-left transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 w-full"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600">
                <MoreHorizontal className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-slate-800">More Actions</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">View all actions</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {onChangeStatus ? (
              <DropdownMenuItem onClick={onChangeStatus}>Change Status</DropdownMenuItem>
            ) : null}
            {onLogCallNote ? (
              <DropdownMenuItem onClick={onLogCallNote}>Log Call Note</DropdownMenuItem>
            ) : null}
            {phone ? (
              <DropdownMenuItem asChild>
                <a href={`tel:${phone}`}>Dial {phone}</a>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled>Export Lead</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      </div>

      {/* Controlled WhatsApp picker — trigger hidden, opened via Quick Action tile */}
      {canUseWhatsApp ? (
        <WhatsAppActionButton
          lead={lead}
          leadId={leadId}
          contactEndpoint={contactEndpoint}
          onContactLogged={onContactLogged}
          open={waOpen}
          onOpenChange={setWaOpen}
          hideTrigger
        />
      ) : null}

      {canSendEmail ? (
        <EmailComposerModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          lead={lead}
          leadId={leadId}
          emailEndpoint={contactEndpoint}
          onSent={() => {
            setEmailOpen(false);
            (onEmailSent || onContactLogged)?.();
          }}
        />
      ) : null}
    </div>
  );
}
