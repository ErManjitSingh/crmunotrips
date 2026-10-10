import { computeLeadAge, formatSource, DETAIL_CARD } from './leadDetailUtils';
import { formatCallDurationExact } from '../../lib/callSession';
import { useAuth } from '../../context/AuthContext';

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-white text-right font-medium capitalize">{value ?? '—'}</span>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className={DETAIL_CARD}>
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

const SOURCE_HIDDEN_ROLES = ['sales_executive', 'team_leader'];

export default function LeadCustomerPanel({ lead }) {
  const { user } = useAuth();
  // Lead Source is hidden from Sales Executive and Team Leader only — Admin/Sales Manager
  // still see it. The underlying lead.source data/API is untouched; this only skips
  // rendering the row.
  const canSeeSource = !SOURCE_HIDDEN_ROLES.includes(user?.role);
  const lastContacted = lead.lastContactedAt
    ? new Date(lead.lastContactedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="space-y-4">
      <Card title="Customer Overview">
        <InfoRow label="Full Name" value={lead.name} />
        <InfoRow label="Phone" value={lead.phone} />
        {lead.alternatePhone ? <InfoRow label="Alt. Phone" value={lead.alternatePhone} /> : null}
        <InfoRow label="Email" value={lead.email} />
        {lead.alternateEmail ? <InfoRow label="Alt. Email" value={lead.alternateEmail} /> : null}
        <InfoRow
          label="Date of Birth"
          value={lead.dateOfBirth
            ? new Date(lead.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        />
        <InfoRow label="Location" value={[lead.subCity, lead.city, lead.state].filter(Boolean).join(', ') || '—'} />
        <InfoRow label="Lead Age" value={computeLeadAge(lead.createdAt)} />
        <InfoRow label="Last Contacted" value={lastContacted} />
        <InfoRow label="Lead Owner" value={lead.assignedTo?.name || 'Unassigned'} />
      </Card>

      <Card title="Travel Information">
        <InfoRow label="Destination" value={lead.destination} />
        <InfoRow
          label="Tour Start"
          value={lead.travelDate
            ? new Date(lead.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        />
        <InfoRow
          label="Tour End"
          value={lead.returnDate
            ? new Date(lead.returnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        />
        <InfoRow label="Tour Days" value={lead.tourDays || '—'} />
        <InfoRow label="Rooms" value={lead.numberOfRooms || '—'} />
        <InfoRow label="Rooms with Mattress" value={lead.roomsWithMattress ?? 0} />
        <InfoRow label="Pickup city / point" value={lead.pickupPoint || '—'} />
        <InfoRow label="Drop city / point" value={lead.dropPoint || '—'} />
        <InfoRow
          label="Cab"
          value={String(lead.cabType || lead.transportRequirement || '—').replace(/_/g, ' ')}
        />
        <InfoRow label="Adults" value={lead.adults ?? Math.max(1, (lead.travelers || 2) - (lead.children || 0))} />
        <InfoRow label="Children" value={lead.children ?? 0} />
        <InfoRow
          label="Hotel"
          value={String(lead.hotelCategory || '—').replace(/_/g, ' ')}
        />
        <InfoRow label="Meal Plan" value={(lead.mealPlan || lead.mealPreference || 'map').toString().toUpperCase()} />
        <InfoRow
          label="Food Preference"
          value={{ veg: 'Veg', non_veg: 'Non-Veg' }[lead.foodPreference] || '—'}
        />
        <InfoRow label="Intent" value={lead.priority || '—'} />
        {canSeeSource && <InfoRow label="Source" value={formatSource(lead)} />}
        <InfoRow label="Package Type" value={lead.leadType?.replace(/_/g, ' ') || '—'} />
        <InfoRow
          label="Calls"
          value={
            lead.callStats?.count
              ? `${lead.callStats.count}x · ${formatCallDurationExact(lead.callStats.totalDurationSeconds || 0)}`
              : 'No calls yet'
          }
        />
      </Card>
    </div>
  );
}
