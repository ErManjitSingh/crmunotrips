import { computeLeadAge, formatSource, DETAIL_CARD } from './leadDetailUtils';

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

export default function LeadCustomerPanel({ lead }) {
  const lastContacted = lead.lastContactedAt
    ? new Date(lead.lastContactedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="space-y-4">
      <Card title="Customer Overview">
        <InfoRow label="Full Name" value={lead.name} />
        <InfoRow label="Phone" value={lead.phone} />
        <InfoRow label="Email" value={lead.email} />
        <InfoRow label="Location" value={[lead.city, lead.state].filter(Boolean).join(', ') || '—'} />
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
        <InfoRow label="Pickup" value={lead.pickupPoint || '—'} />
        <InfoRow label="Drop" value={lead.dropPoint || '—'} />
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
        <InfoRow label="Budget" value={lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—'} />
        <InfoRow label="Source" value={formatSource(lead)} />
        <InfoRow label="Package Type" value={lead.leadType?.replace(/_/g, ' ') || '—'} />
      </Card>
    </div>
  );
}
