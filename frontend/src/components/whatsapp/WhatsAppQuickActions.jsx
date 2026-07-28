import {
  Phone,
  CalendarClock,
  StickyNote,
  FileText,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { Button } from '../ui/button';

const actions = [
  { key: 'call', label: 'Call Customer', icon: Phone, variant: 'outline' },
  { key: 'followup', label: 'Create Follow Up', icon: CalendarClock, variant: 'outline' },
  { key: 'note', label: 'Add Note', icon: StickyNote, variant: 'outline' },
  { key: 'quotation', label: 'Create Quotation', icon: FileText, variant: 'emerald' },
  { key: 'status', label: 'Lead status', icon: RefreshCw, variant: 'outline' },
  { key: 'assign', label: 'Assign Lead', icon: UserPlus, variant: 'outline', adminOnly: true },
];

export default function WhatsAppQuickActions({ lead, onAction, canAssign = true }) {
  if (!lead) return null;

  const visible = actions.filter((a) => (a.adminOnly ? canAssign : true));

  return (
    <div className="grid grid-cols-2 gap-2">
      {visible.map(({ key, label, icon: Icon, variant }) => (
        <Button
          key={key}
          type="button"
          variant={variant}
          size="sm"
          onClick={() => onAction(key)}
          className="justify-start gap-2 text-xs h-9 rounded-xl"
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      ))}
    </div>
  );
}
