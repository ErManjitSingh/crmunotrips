import { Link } from 'react-router-dom';
import { Phone, CalendarPlus, UserCheck, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { DETAIL_CARD } from './leadDetailUtils';

const actions = [
  { icon: Phone, label: 'Log Call Note', action: 'callnote', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' },
  { icon: UserCheck, label: 'Assign Lead', action: 'assign', tone: 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100' },
  { icon: Pencil, label: 'Edit Lead', action: 'edit', tone: 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100' },
];

export default function LeadActionPanel({
  onLogCallNote,
  onAssign,
  onChangeStatus,
  canEditLead = true,
  canChangeStatus = true,
  editHref,
}) {
  return (
    <div className={DETAIL_CARD}>
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Actions</h3>
      </div>
      <div className="p-4 grid grid-cols-1 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          if (action.action === 'assign' && !onAssign) return null;
          if (action.action === 'callnote' && !onLogCallNote) return null;
          if (action.action === 'edit' && (!canEditLead || !editHref)) return null;

          if (action.action === 'edit' && editHref) {
            return (
              <Link
                key={action.label}
                to={editHref}
                className={cn('flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors', action.tone)}
              >
                <Icon className="w-4 h-4" /> {action.label}
              </Link>
            );
          }

          return (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                if (action.action === 'callnote') onLogCallNote?.();
                if (action.action === 'assign') onAssign?.();
              }}
              className={cn('flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors text-left', action.tone)}
            >
              <Icon className="w-4 h-4" /> {action.label}
            </button>
          );
        })}
        {canChangeStatus && onChangeStatus && (
          <Button
            type="button"
            variant="outline"
            onClick={onChangeStatus}
            className="w-full rounded-xl justify-start gap-2.5 h-auto py-2.5 bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 font-semibold"
          >
            <CalendarPlus className="w-4 h-4" /> Lead status
          </Button>
        )}
      </div>
    </div>
  );
}
