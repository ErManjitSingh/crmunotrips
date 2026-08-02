import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Mail, MapPin, Phone, User, Users, Calendar, Send, Package } from 'lucide-react';
import AppDrawer from '../ui/AppDrawer';
import Avatar from '../ui/Avatar';
import QuoteStatusBadge from './QuoteStatusBadge';
import QuotePricingPanel from './QuotePricingPanel';
import QuoteTimeline from './QuoteTimeline';
import MobileQuotationDetail from './MobileQuotationDetail';
import QuotationRevisionCompareBanner from './QuotationRevisionCompareBanner';
import { Button } from '../ui/button';
import { formatINR } from './quotationUtils';

function useIsDesktopLg() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="w-4 h-4 text-content-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-medium text-content-muted tracking-wide">{label}</p>
        <p className="text-content-primary break-words">{value}</p>
      </div>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function CostingCard({ title, costing, tone = 'sky' }) {
  if (!costing) {
    return (
      <div className="rounded-xl border border-dashed border-subtle p-3 text-xs text-content-muted">
        {title}: not set yet
      </div>
    );
  }
  const tones = {
    sky: 'border-sky-200 bg-sky-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  };
  return (
    <div className={`rounded-xl border p-3 space-y-1.5 ${tones[tone] || tones.sky}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</p>
      <p className="text-lg font-bold tabular-nums text-slate-900">
        {Number(costing.markupPercent || 0)}%
        <span className="ml-2 text-sm font-semibold text-slate-600">
          · {formatINR(costing.grandTotal)}
        </span>
      </p>
      <p className="text-[11px] text-slate-600">
        Base {formatINR(costing.baseCost)} · Margin {Number(costing.profitMargin || 0)}%
        {costing.taxes ? ` · GST/Tax ${formatINR(costing.taxes)}` : ''}
      </p>
      {costing.setByName && (
        <p className="text-[11px] font-semibold text-emerald-800">
          Set by {costing.setByName}
          {costing.setByRole ? ` (${String(costing.setByRole).replace(/_/g, ' ')})` : ''}
          {costing.setAt ? ` · ${formatDateTime(costing.setAt)}` : ''}
        </p>
      )}
    </div>
  );
}

export default function QuotationDetailDrawer({
  quote,
  open,
  onClose,
  readOnly = false,
  onDownloadPdf,
  actions,
  canSetCosting = false,
  onApproveWithCosting,
  editHref,
  onEdit,
  onFollowUp,
  onAddNote,
  onViewPreviousQuotation,
  viewingPreviousQuotation = false,
}) {
  const [costingPercent, setCostingPercent] = useState('');
  const [approving, setApproving] = useState(false);
  const isDesktop = useIsDesktopLg();

  const summary = useMemo(() => {
    if (!quote) return null;
    return quote.packageSummary || {
      packageName: quote.package?.name || quote.packageSnapshot?.name || 'Custom package',
      destination: quote.lead?.destination || quote.packageSnapshot?.destination || '',
      hotelsCount: (quote.selectedHotels || []).length,
      hotelNames: (quote.selectedHotels || []).slice(0, 4).map((h) => h.name || h.snapshot?.name).filter(Boolean),
      cabsCount: (quote.selectedCabs || []).length,
      activitiesCount: (quote.selectedActivities || []).length,
      customizations: quote.customizations || '',
      duration: quote.packageSnapshot?.duration || quote.packageSnapshot?.days,
    };
  }, [quote]);

  if (!quote) return null;

  const lead = quote.lead || {};
  const creatorName = quote.createdByExecutive?.name || quote.createdBy?.name || '—';
  const packageName = summary?.packageName || 'Custom package';
  const sentEvent = [...(quote.timeline || [])].reverse().find((t) => t.type === 'sent');
  const defaultPct = quote.costing1?.markupPercent ?? quote.pricing?.markupPercent ?? 0;

  const handleApprove = async () => {
    if (!onApproveWithCosting) return;
    setApproving(true);
    try {
      const pct = costingPercent === '' ? defaultPct : Number(costingPercent);
      await onApproveWithCosting(quote._id, pct);
      onClose?.();
    } finally {
      setApproving(false);
    }
  };

  return (
    <>
      {!isDesktop ? (
        <MobileQuotationDetail
          quote={quote}
          open={open}
          onClose={onClose}
          editHref={editHref}
          onEdit={onEdit}
          onFollowUp={onFollowUp}
          onAddNote={onAddNote}
          onDownloadPdf={onDownloadPdf}
          actions={!readOnly ? actions : null}
          headerExtra={(
            <QuotationRevisionCompareBanner
              quote={quote}
              onViewPrevious={onViewPreviousQuotation}
              viewingPrevious={viewingPreviousQuotation}
            />
          )}
        />
      ) : (
        <AppDrawer open={open} onClose={onClose} className="max-w-xl overflow-y-auto">
          <div className="p-5 border-b border-subtle bg-gradient-to-r from-sky-500/10 to-indigo-500/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sky-600 font-semibold text-sm">{quote.quoteNumber}</p>
                <h3 className="text-lg font-bold text-content-primary truncate">{lead.name || 'Customer'}</h3>
                <p className="text-xs text-content-muted mt-0.5">{packageName}</p>
              </div>
              <QuoteStatusBadge status={quote.status} />
            </div>
          </div>

          <div className="p-5 space-y-6">
            <QuotationRevisionCompareBanner
              quote={quote}
              onViewPrevious={onViewPreviousQuotation}
              viewingPrevious={viewingPreviousQuotation}
            />

            {quote.resubmissionReason && !quote.isRevisionSubmission ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Executive reason for re-submission
                </p>
                <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{quote.resubmissionReason}</p>
              </div>
            ) : null}

            <section className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-content-muted">Customer (sent to)</h4>
              <div className="rounded-xl border border-subtle bg-surface-elevated/40 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={lead.name} size="md" />
                  <div>
                    <p className="font-semibold text-content-primary">{lead.name || '—'}</p>
                    <p className="text-xs text-content-muted">{lead.destination || '—'}</p>
                  </div>
                </div>
                <InfoRow icon={Phone} label="Phone" value={lead.phone} />
                <InfoRow icon={Mail} label="Email" value={lead.email} />
                <InfoRow icon={MapPin} label="Destination" value={lead.destination} />
                <InfoRow
                  icon={Calendar}
                  label="Travel date"
                  value={
                    lead.travelDate
                      ? new Date(lead.travelDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : null
                  }
                />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-content-muted">Who created & handled</h4>
              <div className="rounded-xl border border-subtle bg-surface-elevated/40 p-4 grid sm:grid-cols-2 gap-3">
                <InfoRow icon={User} label="Created by" value={creatorName} />
                <InfoRow icon={Users} label="Lead executive" value={lead.assignedTo?.name || quote.createdByExecutive?.name} />
                <InfoRow icon={User} label="Team leader" value={quote.teamLeader?.name} />
                <InfoRow icon={User} label="Approved by" value={quote.approvedBy?.name} />
                <InfoRow icon={Calendar} label="Approved on" value={formatDateTime(quote.approvedAt)} />
                <InfoRow icon={Calendar} label="Created on" value={formatDateTime(quote.createdAt)} />
                <InfoRow
                  icon={Send}
                  label="Sent to customer"
                  value={formatDateTime(quote.sentAt) || (sentEvent ? formatDateTime(sentEvent.date) : null)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-content-muted flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Package & short summary
              </h4>
              <div className="rounded-xl border border-subtle bg-surface-elevated/40 p-4 space-y-2 text-sm">
                <p className="font-bold text-content-primary">{packageName}</p>
                {summary?.destination && (
                  <p className="text-content-secondary">
                    Going to: <span className="font-semibold">{summary.destination}</span>
                  </p>
                )}
                {summary?.duration != null && (
                  <p className="text-content-secondary">
                    Duration: <span className="font-semibold">{summary.duration} days</span>
                  </p>
                )}
                <p className="text-content-secondary">
                  Hotels: <span className="font-semibold">{summary?.hotelsCount || 0}</span>
                  {summary?.hotelNames?.length ? ` — ${summary.hotelNames.join(', ')}` : ''}
                </p>
                <p className="text-content-secondary">
                  Cabs: <span className="font-semibold">{summary?.cabsCount || 0}</span>
                  {' · '}
                  Activities: <span className="font-semibold">{summary?.activitiesCount || 0}</span>
                </p>
                {summary?.customizations && (
                  <p className="text-xs text-content-secondary whitespace-pre-wrap pt-1 border-t border-subtle">
                    {summary.customizations}
                  </p>
                )}
                <p className="text-xl font-bold text-brand-600 metric-tabular pt-1">
                  {formatINR(quote.pricing?.total || quote.costing2?.grandTotal || quote.costing1?.grandTotal)}
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-wider text-content-muted">Costing</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <CostingCard title="Costing 1 (Executive)" costing={quote.costing1} tone="sky" />
                <CostingCard title="Costing 2 (Approver)" costing={quote.costing2} tone="emerald" />
              </div>
              {canSetCosting && quote.status === 'pending_approval' && onApproveWithCosting && (
                <div className="rounded-xl border border-emerald-200 bg-white p-3 space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Set Costing 2 % then approve
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder={String(defaultPct)}
                      value={costingPercent}
                      onChange={(e) => setCostingPercent(e.target.value)}
                      className="h-10 w-28 rounded-xl border border-subtle px-3 text-sm"
                    />
                    <Button
                      type="button"
                      variant="emerald"
                      className="flex-1"
                      disabled={approving}
                      onClick={handleApprove}
                    >
                      {approving ? 'Approving…' : 'Approve with Costing 2'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Leave blank to keep executive % ({defaultPct}%). Executive will see who set Costing 2.
                  </p>
                </div>
              )}
              <QuotePricingPanel
                pricing={quote.pricing}
                readOnly
                inclusions={
                  quote.packageSnapshot?.inclusions ||
                  quote.package?.inclusions ||
                  []
                }
              />
            </section>

            {quote.timeline?.length > 0 && (
              <section>
                <h4 className="text-xs font-medium uppercase tracking-wider text-content-muted mb-3">Activity timeline</h4>
                <QuoteTimeline timeline={quote.timeline} />
              </section>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {editHref && (
                <Link to={editHref} className="flex-1">
                  <Button variant="outline" className="w-full rounded-xl gap-2">
                    Edit Quotation
                  </Button>
                </Link>
              )}
              {!editHref && onEdit && (
                <Button onClick={() => onEdit(quote)} variant="outline" className="rounded-xl gap-2 flex-1">
                  Edit Quotation
                </Button>
              )}
              {onDownloadPdf && (
                <Button onClick={onDownloadPdf} variant="sky" className="rounded-xl gap-2 flex-1">
                  <Download className="w-4 h-4" /> View PDF
                </Button>
              )}
              {!readOnly && actions}
            </div>
          </div>
        </AppDrawer>
      )}
    </>
  );
}
