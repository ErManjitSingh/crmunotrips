import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, MessageSquare, Plus } from 'lucide-react';
import API from '../../api/axios';
import { unwrapList } from '../../utils/apiHelpers';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { formatCurrency, QUOTE_STATUS_STYLES } from './leaderUtils';
import QuotationFiltersPanel from '../quotations/QuotationFiltersPanel';
import QuotationDetailDrawer from '../quotations/QuotationDetailDrawer';
import QuotationPdfOverlay from '../quotations/QuotationPdfOverlay';
import {
  emptyQuotationFilters,
  countQuotationActiveFilters,
  buildQuotationQueryParams,
  SEGMENT_LABELS,
} from '../quotations/quotationFilterUtils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const META = {
  pending: { title: 'Pending Approval', desc: 'Quotations from your team awaiting your approval' },
  negotiation: { title: 'Negotiation Cases', desc: 'Active price discussions in your squad' },
  approved: { title: 'Approved Quotations', desc: 'Quotes you approved — executives can send to customers' },
  rejected: { title: 'Rejected Quotations', desc: 'Quotes declined or sent back for changes' },
};

export default function LeaderQuotationsPage() {
  const { status = 'pending' } = useParams();
  const [quotes, setQuotes] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [draftFilters, setDraftFilters] = useState(emptyQuotationFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyQuotationFilters);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const pdfRef = useRef(null);
  const meta = META[status] || META.pending;
  const debouncedSearch = useDebouncedValue(appliedFilters.search, 350);

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...buildQuotationQueryParams({ ...appliedFilters, search: debouncedSearch }, { ignoreStatus: true }),
    }),
    [appliedFilters, debouncedSearch]
  );

  useEffect(() => {
    API.get('/leads/assignees', { skipSuccessToast: true, skipErrorToast: true })
      .then((r) => setExecutives(r.data?.salesExecutives || []))
      .catch(() => setExecutives([]));
  }, []);

  const fetchQuotes = () => {
    setLoading(true);
    API.get(`/team-leader/quotations/${status}`, { params: queryParams, skipSuccessToast: true })
      .then((r) => setQuotes(unwrapList(r.data)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuotes();
  }, [status, queryParams]);

  const handleAction = async (id, action, costingPercent) => {
    const notes =
      action === 'reject'
        ? window.prompt('Rejection reason (optional):') || undefined
        : action === 'changes'
          ? window.prompt('Changes requested (optional):') || undefined
          : undefined;
    await API.put(`/team-leader/quotations/${id}`, {
      action,
      notes,
      ...(action === 'approve' && costingPercent != null ? { costingPercent } : {}),
    });
    fetchQuotes();
  };

  const hasActiveFilters = countQuotationActiveFilters(appliedFilters) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.desc}
        breadcrumbs={['Team Leader', 'Quotations', meta.title]}
        actions={(
          <Link to="/team-leader/quotations/new">
            <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" /> Create Quotation</Button>
          </Link>
        )}
      />

      <QuotationFiltersPanel
        filters={draftFilters}
        onChange={setDraftFilters}
        onApply={() => setAppliedFilters({ ...draftFilters })}
        onClear={() => {
          setDraftFilters(emptyQuotationFilters);
          setAppliedFilters(emptyQuotationFilters);
        }}
        onRefresh={fetchQuotes}
        hasActiveFilters={hasActiveFilters}
        showExecutiveFilter
        executives={executives}
        segmentLabel={SEGMENT_LABELS[status] || status}
      />

      <div className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-subtle bg-surface-elevated/50">
                {['Quote #', 'Customer', 'Destination', 'Executive', 'Amount', 'Status', 'Margin', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-content-muted">
                    Loading…
                  </td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-content-muted">
                    No quotations match your filters
                  </td>
                </tr>
              ) : (
                quotes.map((q) => (
                  <tr
                    key={q._id}
                    className="hover:bg-amber-500/[0.03] cursor-pointer"
                    onClick={() => setSelected(q)}
                  >
                    <td className="px-4 py-3.5 font-mono text-xs font-medium text-amber-600">{q.quoteNumber}</td>
                    <td className="px-4 py-3.5 font-medium">{q.lead?.name}</td>
                    <td className="px-4 py-3.5 text-content-secondary">{q.lead?.destination}</td>
                    <td className="px-4 py-3.5 text-content-secondary">
                      {q.createdByExecutive?.name || q.lead?.assignedTo?.name || '—'}
                    </td>
                    <td className="px-4 py-3.5 font-semibold tabular-nums">{formatCurrency(q.pricing?.total)}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          'text-[10px] font-medium uppercase px-2 py-1 rounded-full ring-1 ring-inset',
                          QUOTE_STATUS_STYLES[q.status] || QUOTE_STATUS_STYLES.draft
                        )}
                      >
                        {(q.status || 'draft').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-medium ${(q.pricing?.profitMargin || 0) >= 10 ? 'text-emerald-600' : 'text-amber-600'}`}
                      >
                        {q.pricing?.profitMargin}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      {status === 'pending' && q.status === 'pending_approval' && (
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="emerald" className="h-8" onClick={() => handleAction(q._id, 'approve')}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-rose-600 border-rose-500/30"
                            onClick={() => handleAction(q._id, 'reject')}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => handleAction(q._id, 'changes')}>
                            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Changes
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QuotationDetailDrawer
        quote={selected}
        open={!!selected && !showPdf}
        onClose={() => { setSelected(null); setShowPdf(false); }}
        onDownloadPdf={() => setShowPdf(true)}
        canSetCosting={status === 'pending'}
        onApproveWithCosting={async (id, costingPercent) => {
          await handleAction(id, 'approve', costingPercent);
          setSelected(null);
        }}
        actions={
          status === 'pending' && selected?.status === 'pending_approval' ? (
            <>
              <Button size="sm" variant="outline" className="flex-1 text-rose-600" onClick={() => { handleAction(selected._id, 'reject'); setSelected(null); }}>
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => { handleAction(selected._id, 'changes'); setSelected(null); }}>
                <MessageSquare className="w-3.5 h-3.5 mr-1" /> Changes
              </Button>
            </>
          ) : null
        }
      />

      <QuotationPdfOverlay
        quote={selected}
        open={showPdf}
        onClose={() => setShowPdf(false)}
        pdfRef={pdfRef}
      />
    </div>
  );
}
