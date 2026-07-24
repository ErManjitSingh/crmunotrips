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

export default function LeadActionsMenu({ lead, onScheduleFollowUp, onChangeStatus, canChangeStatus = true }) {
  const phone = lead.phone?.replace(/\s/g, '');

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
        <DropdownMenuItem asChild>
          <Link to={`/sales-executive/leads/${lead._id}/view`} className="flex items-center gap-2 cursor-pointer">
            <Eye className="w-4 h-4" /> View Lead
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/sales-executive/leads/${lead._id}/edit`} className="flex items-center gap-2 cursor-pointer">
            <Pencil className="w-4 h-4" /> Edit Lead
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => phone && beginLeadCall({ leadId: lead._id, leadName: lead.name, phone })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Phone className="w-4 h-4" /> Call Customer
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://wa.me/${phone?.replace('+', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 cursor-pointer">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onScheduleFollowUp?.(lead)} className="flex items-center gap-2 cursor-pointer">
          <CalendarClock className="w-4 h-4" /> Schedule Follow-up
        </DropdownMenuItem>
        {canChangeStatus && onChangeStatus && (
          <DropdownMenuItem onClick={() => onChangeStatus(lead)} className="flex items-center gap-2 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Change Status
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
