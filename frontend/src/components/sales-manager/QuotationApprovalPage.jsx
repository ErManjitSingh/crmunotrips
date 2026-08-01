import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, MessageSquare, Plus } from 'lucide-react';
import API from '../../api/axios';
import { unwrapList } from '../../utils/apiHelpers';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { formatCurrency } from './managerUtils';
import QuotationFiltersPanel from '../quotations/QuotationFiltersPanel';
import QuotationDetailDrawer from '../quotations/QuotationDetailDrawer';
import QuotationPdfOverlay from '../quotations/QuotationPdfOverlay';
import { formatDiscountLabel } from '../quotations/quotationUtils';
import {
  emptyQuotationFilters,
  countQuotationActiveFilters,
  buildQuotationQueryParams,
  SEGMENT_LABELS,
} from '../quotations/quotationFilterUtils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { toast } from '../../context/ToastContext';

const META = {
  pending: { title: 'Pending Approval', desc: 'Review and approve team quotations' },
  approved: { title: 'Approved Quotes', desc: 'Quotations approved by management' },
  rejected: { title: 'Rejected Quotes', desc: 'Quotations rejected or sent back' },
};

export default function QuotationApprovalPage() {
  const { status = 'pending' } = useParams();
  const [quotes, setQuotes] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [draftFilters, setDraftFilters] = useState(emptyQuotationFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyQuotationFilters);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfQuote, setPdfQuote] = useState(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
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
    API.get(`/sales-manager/quotations/${status}`, { params: queryParams, skipSuccessToast: true })
      .then((r) => setQuotes(unwrapList(r.data)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuotes();
  }, [status, queryParams]);

  const handleAction = async (id, action, costingPercent) => {
    await API.put(`/sales-manager/quotations/${id}`, {
      action,
      ...(action === 'approve' && costingPercent != null ? { costingPercent } : {}),
    });
    fetchQuotes();
  };

  const handleViewPrevious = async () => {
    const prevId = selected?.previousQuotation?._id;
    if (!prevId) return;
    setLoadingPrevious(true);
    try {
      const res = await API.get(`/quotations/${prevId}`, { skipSuccessToast: true });
      setPdfQuote(res.data);
      setShowPdf(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open previous quotation');
    } finally {
      setLoadingPrevious(false);
    }
  };

  const hasActiveFilters = countQuotationActiveFilters(appliedFilters) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.desc}
        breadcrumbs={['Sales Manager', 'Quotations', meta.title]}
        actions={(
          <Link to="/sales-manager/quotations/new">
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
                {['Quote #', 'Customer', 'Destination', 'Amount', 'Discount', 'Margin', 'Executive', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr><td colSpan={8} className="p-12 text-center text-content-muted">Loading…</td></tr>
              ) : quotes.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-content-muted">No quotations match your filters</td></tr>
              ) : quotes.map((q) => (
                <tr key={q._id} className="hover:bg-violet-500/[0.03] cursor-pointer" onClick={() => setSelected(q)}>
                  <td className="px-4 py-3.5 font-mono text-xs font-medium text-brand-600">
                    <div>{q.quoteNumber}</div>
                    {q.isRevisionSubmission && (
                      <span className="mt-1 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                        File #{q.submissionIndex}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-content-primary">{q.lead?.name}</td>
                  <td className="px-4 py-3.5 text-content-secondary">{q.lead?.destination}</td>
                  <td className="px-4 py-3.5 font-semibold tabular-nums">{formatCurrency(q.pricing?.total)}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs font-semibold tabular-nums text-amber-800">
                      {formatDiscountLabel(q.discountSummary || q.pricing)}
                    </div>
                    {q.previousQuotation && (
                      <p className="mt-0.5 text-[10px] text-content-muted">
                        Prev: {formatDiscountLabel(q.previousQuotation)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5"><span className={`font-medium ${(q.pricing?.profitMargin || 0) >= 10 ? 'text-emerald-600' : 'text-amber-600'}`}>{q.pricing?.profitMargin}%</span></td>
                  <td className="px-4 py-3.5 text-content-secondary">{q.executive || '—'}</td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {status === 'pending' && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="emerald" className="h-8" onClick={() => handleAction(q._id, 'approve')}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve</Button>
                        <Button size="sm" variant="outline" className="h-8 text-rose-600 border-rose-500/30" onClick={() => handleAction(q._id, 'reject')}><XCircle className="w-3.5 h-3.5 mr-1" /> Reject</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => handleAction(q._id, 'changes')}><MessageSquare className="w-3.5 h-3.5 mr-1" /> Changes</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <QuotationDetailDrawer
        quote={selected}
        open={!!selected && !showPdf}
        onClose={() => { setSelected(null); setShowPdf(false); setPdfQuote(null); }}
        onDownloadPdf={() => {
          setPdfQuote(selected);
          setShowPdf(true);
        }}
        onViewPreviousQuotation={selected?.previousQuotation?._id ? handleViewPrevious : undefined}
        viewingPreviousQuotation={loadingPrevious}
        canSetCosting={status === 'pending'}
        onApproveWithCosting={async (id, costingPercent) => {
          await handleAction(id, 'approve', costingPercent);
          setSelected(null);
        }}
        actions={
          status === 'pending' && selected ? (
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
        quote={pdfQuote || selected}
        open={showPdf}
        onClose={() => { setShowPdf(false); setPdfQuote(null); }}
        pdfRef={pdfRef}
      />
    </div>
  );
}
