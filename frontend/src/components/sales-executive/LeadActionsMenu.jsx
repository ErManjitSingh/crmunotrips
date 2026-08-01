import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MoreVertical, Eye, Phone, MessageCircle, Pencil,
  CalendarClock, RefreshCw, FileText,
} from 'lucide-react';
import {
  DropdownMenuRoot,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';
import { beginLeadCall } from '../../lib/callSession';

export default function LeadActionsMenu({
  lead,
  onScheduleFollowUp,
  onChangeStatus,
  canChangeStatus = true,
  contactLocked = false,
}) {
  const phone = lead.phone?.replace(/\s/g, '');
  const locked = contactLocked || lead?.contactMasked || lead?.returnedToPool || phone === 'XXXX';

  return (
    <DropdownMenuRoot modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0 rounded-xl text-content-muted hover:text-content-primary hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {!locked && (
          <DropdownMenuItem asChild>
            <Link to={`/sales-executive/leads/${lead._id}/view`} className="flex items-center gap-2 cursor-pointer">
              <Eye className="w-4 h-4" /> View Lead
            </Link>
          </DropdownMenuItem>
        )}
        {locked && (
          <DropdownMenuItem disabled className="flex items-center gap-2 opacity-70">
            <Eye className="w-4 h-4" /> Lead returned — no access
          </DropdownMenuItem>
        )}
        {!locked && (
          <DropdownMenuItem asChild>
            <Link to={`/sales-executive/leads/${lead._id}/edit`} className="flex items-center gap-2 cursor-pointer">
              <Pencil className="w-4 h-4" /> Edit Lead
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={locked || !phone}
          onClick={() => !locked && phone && beginLeadCall({ leadId: lead._id, leadName: lead.name, phone })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Phone className="w-4 h-4" /> {locked ? 'Call locked' : 'Call Customer'}
        </DropdownMenuItem>
        {!locked ? (
          <DropdownMenuItem asChild>
            <a href={`https://wa.me/${phone?.replace('+', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 cursor-pointer">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="flex items-center gap-2 opacity-70">
            <MessageCircle className="w-4 h-4" /> WhatsApp locked
          </DropdownMenuItem>
        )}
        {!locked && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onScheduleFollowUp?.(lead)} className="flex items-center gap-2 cursor-pointer">
              <CalendarClock className="w-4 h-4" /> Lead follow up
            </DropdownMenuItem>
            {canChangeStatus && onChangeStatus && (
              <DropdownMenuItem onClick={() => onChangeStatus(lead)} className="flex items-center gap-2 cursor-pointer">
                <RefreshCw className="w-4 h-4" /> Lead status
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link
                to={`/sales-executive/quotations/new?leadId=${lead._id}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" /> Create Quotation
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}

export function ActionModal({ open, title, onClose, children }) {
  return (
    <AppModal open={open} onClose={onClose} size="md" className="p-6">
      <h3 className="text-lg font-bold text-content-primary mb-4">{title}</h3>
      {children}
    </AppModal>
  );
}
