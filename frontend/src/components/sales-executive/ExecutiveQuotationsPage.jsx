import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send,
  Plus,
  CheckCircle2,
  MapPin,
  Calendar,
  MoreHorizontal,
  Phone,
  Pencil,
} from 'lucide-react';
import API from '../../api/axios';
import { unwrapList } from '../../utils/apiHelpers';
import ExecutivePageShell from './ExecutivePageShell';
import ExecutiveQuotationKpiStrip from './ExecutiveQuotationKpiStrip';
import MobileExecutiveQuotations from './MobileExecutiveQuotations';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { formatCurrency, QUOTE_STATUS_STYLES } from './executiveUtils';
import QuotationFiltersPanel from '../quotations/QuotationFiltersPanel';
import QuotationDetailDrawer from '../quotations/QuotationDetailDrawer';
import QuotationPdfOverlay from '../quotations/QuotationPdfOverlay';
import {
  emptyQuotationFilters,
  countQuotationActiveFilters,
  buildQuotationQueryParams,
} from '../quotations/quotationFilterUtils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const STATUS_TABS = ['all', 'draft', 'pending_approval', 'approved', 'sent', 'rejected'];

const STATUS_LABELS = {
  all: 'All',
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  sent: 'Sent',
  rejected: 'Rejected',
};

function avatarTone(name = '') {
  const tones = ['bg-orange-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
  return tones[(name.charCodeAt(0) || 0) % tones.length];
}

function formatCreatedOn(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function phoneDisplay(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last10 = digits.slice(-10);
  return last10.length === 10 ? `+91 ${last10}` : `+${digits}`;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ExecutiveQuotationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [kpiCounts, setKpiCounts] = useState({
    total: 0,
    sent: 0,
    approved: 0,
    pending_approval: 0,
    rejected: 0,
  });
  const [statusTab, setStatusTab] = useState('all');
  const [draftFilters, setDraftFilters] = useState(emptyQuotationFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyQuotationFilters);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState(location.state?.message || '');
  const [selected, setSelected] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [submitGate, setSubmitGate] = useState({
    open: false,
    quote: null,
    reason: '',
    needsReason: false,
    submitting: false,
  });
  const pdfRef = useRef(null);

  const debouncedSearch = useDebouncedValue(appliedFilters.search, 350);

  const queryParams = useMemo(() => {
    const params = buildQuotationQueryParams(
      { ...appliedFilters, search: debouncedSearch },
      { ignoreStatus: true }
    );
    if (statusTab !== 'all') params.status = statusTab;
    return { page: 1, limit: 200, ...params };
  }, [appliedFilters, debouncedSearch, statusTab]);

  const fetchKpis = () => {
    API.get('/sales-executive/quotations', {
      params: { page: 1, limit: 200 },
      skipSuccessToast: true,
    })
      .then((r) => {
        const rows = unwrapList(r.data);
        const monthStart = startOfMonth();
        setKpiCounts({
          total: rows.length,
          sent: rows.filter((q) => q.status === 'sent' || q.status === 'viewed').length,
          approved: rows.filter((q) => q.status === 'approved').length,
          pending_approval: rows.filter((q) => q.status === 'pending_approval').length,
          rejected: rows.filter(
            (q) => q.status === 'rejected' && new Date(q.updatedAt || q.createdAt) >= monthStart
          ).length,
        });
      })
      .catch(() => {});
  };

  const fetchQuotes = () => {
    setLoading(true);
    API.get('/sales-executive/quotations', { params: queryParams, skipSuccessToast: true })
      .then((r) => setQuotes(unwrapList(r.data)))
      .catch(() => setQuotes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuotes();
  }, [queryParams]);

  useEffect(() => {
    fetchKpis();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusTab, appliedFilters, debouncedSearch, pageSize]);

  useEffect(() => {
    if (location.state?.message) {
      setFlash(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const refreshAll = () => {
    fetchQuotes();
    fetchKpis();
  };

  const handleSend = async (id) => {
    try {
      await API.put(`/sales-executive/quotations/${id}`, { action: 'send' });
      refreshAll();
    } catch {
      /* toast via axios */
    }
  };

  const submitQuotation = async (id, reason = '') => {
    await API.put(`/sales-executive/quotations/${id}`, {
      action: 'submit',
      ...(reason ? { resubmissionReason: reason } : {}),
    });
    refreshAll();
  };

  const handleSubmit = async (quoteOrId) => {
    const quote =
      typeof quoteOrId === 'object' && quoteOrId
        ? quoteOrId
        : quotes.find((q) => String(q._id) === String(quoteOrId));
    const id = quote?._id || quoteOrId;
    if (!id) return;

    const leadId = quote?.lead?._id || quote?.lead;
    if (!leadId) {
      try {
        await submitQuotation(id);
      } catch {
        /* toast via axios */
      }
      return;
    }

    try {
      const { data } = await API.get(`/sales-executive/leads/${leadId}/quotations`, {
        skipErrorToast: true,
        skipSuccessToast: true,
      });
      const rows = Array.isArray(data)
        ? data
        : data?.quotations || data?.data || [];
      const prior = rows.filter((q) => q && q.status !== 'draft' && String(q._id) !== String(id));
      if (prior.length > 0) {
        setSubmitGate({
          open: true,
          quote: quote || { _id: id, lead: leadId },
          reason: '',
          needsReason: true,
          submitting: false,
        });
        return;
      }
      await submitQuotation(id);
    } catch {
      /* toast via axios */
    }
  };

  const confirmSubmitGate = async () => {
    if (!submitGate.quote?._id) return;
    if (submitGate.needsReason && !submitGate.reason.trim()) return;
    setSubmitGate((s) => ({ ...s, submitting: true }));
    try {
      await submitQuotation(submitGate.quote._id, submitGate.reason.trim());
      setSubmitGate({ open: false, quote: null, reason: '', needsReason: false, submitting: false });
      setSelected(null);
    } catch {
      setSubmitGate((s) => ({ ...s, submitting: false }));
    }
  };

  const hasActiveFilters = countQuotationActiveFilters(appliedFilters) > 0;
  const total = quotes.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, pageCount);
  const pageRows = quotes.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  const mobileSearchChange = (value) => {
    setDraftFilters((f) => ({ ...f, search: value }));
    setAppliedFilters((f) => ({ ...f, search: value }));
  };

  const mobileDestinationChange = (value) => {
    setDraftFilters((f) => ({ ...f, destination: value }));
    setAppliedFilters((f) => ({ ...f, destination: value }));
  };

  return (
    <>
      <MobileExecutiveQuotations
        quotes={quotes}
        kpiCounts={kpiCounts}
        statusTab={statusTab}
        onStatusTabChange={setStatusTab}
        search={appliedFilters.search || ''}
        onSearchChange={mobileSearchChange}
        destination={appliedFilters.destination || ''}
        onDestinationChange={mobileDestinationChange}
        onRefresh={refreshAll}
        onOpenQuote={setSelected}
        loading={loading}
        flash={flash}
        onDismissFlash={() => setFlash('')}
      />

      <div className="hidden lg:block">
    <ExecutivePageShell
      title="Quotations"
      description="Your quotes — submitted to Team Leader for approval before sending to customers"
      action={(
        <Link to="/sales-executive/quotations/new">
          <Button className="rounded-xl shrink-0 gap-1.5 bg-[#5D5FEF] hover:bg-[#4f51e5] text-white border-0 shadow-md shadow-[#5D5FEF]/25">
            <Plus className="w-4 h-4" /> Create Quotation
          </Button>
        </Link>
      )}
    >
      {flash && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {flash}
          <button type="button" className="ml-auto text-emerald-600 text-xs font-semibold" onClick={() => setFlash('')}>
            Dismiss
          </button>
        </div>
      )}

      <ExecutiveQuotationKpiStrip
        counts={kpiCounts}
        activeKey={statusTab}
        onSelect={setStatusTab}
      />

      <div className="flex items-center gap-1 border-b border-subtle overflow-x-auto">
        {STATUS_TABS.map((s) => {
          const active = statusTab === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusTab(s)}
              className={cn(
                'relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                active ? 'text-[#5D5FEF]' : 'text-content-muted hover:text-content-primary'
              )}
            >
              {STATUS_LABELS[s]}
              {active && (
                <motion.span
                  layoutId="exec-quote-tab"
                  className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#5D5FEF]"
                />
              )}
            </button>
          );
        })}
      </div>

      <QuotationFiltersPanel
        filters={draftFilters}
        onChange={setDraftFilters}
        onApply={() => setAppliedFilters({ ...draftFilters })}
        onClear={() => {
          setDraftFilters(emptyQuotationFilters);
          setAppliedFilters(emptyQuotationFilters);
        }}
        onRefresh={refreshAll}
        hasActiveFilters={hasActiveFilters}
        segmentLabel={STATUS_LABELS[statusTab]}
        className="rounded-xl border-subtle bg-white dark:bg-slate-900"
      />

      <div className="rounded-2xl border border-subtle bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-subtle bg-slate-50/80 dark:bg-slate-800/40">
                {['Quote #', 'Customer', 'Destination', 'Amount', 'Status', 'Created by', 'Created on', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-content-muted whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-content-muted">Loading…</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-content-muted">
                    No quotations match your filters
                  </td>
                </tr>
              ) : (
                pageRows.map((q) => {
                  const customer = q.lead?.name || '—';
                  const initial = customer.trim().charAt(0).toUpperCase() || '?';
                  const phone = phoneDisplay(q.lead?.phone || q.lead?.whatsapp);
                  const creator = q.createdByExecutive?.name || q.createdBy?.name || '—';

                  return (
                    <tr
                      key={q._id}
                      className="hover:bg-violet-50/40 dark:hover:bg-violet-950/20 cursor-pointer transition-colors"
                      onClick={() => setSelected(q)}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-[#5D5FEF]">{q.quoteNumber}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          <div
                            className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',
                              avatarTone(customer)
                            )}
                          >
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-content-primary truncate">{customer}</p>
                            {phone ? (
                              <p className="text-[11px] text-content-muted flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {phone}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-content-secondary capitalize">
                          <MapPin className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                          {q.lead?.destination || q.packageSnapshot?.destination || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold tabular-nums text-content-primary whitespace-nowrap">
                        {formatCurrency(q.pricing?.total)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ring-1 ring-inset whitespace-nowrap',
                            QUOTE_STATUS_STYLES[q.status] || QUOTE_STATUS_STYLES.draft
                          )}
                        >
                          {(q.status || 'draft').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-content-secondary whitespace-nowrap">
                        {creator}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-content-muted whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-violet-400" />
                          {formatCreatedOn(q.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg h-8 gap-1 text-[11px]"
                            onClick={() => navigate(`/sales-executive/quotations/${q._id}/edit`)}
                            title="Edit quotation"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                          {q.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg h-8 text-[11px]"
                              onClick={() => handleSubmit(q)}
                            >
                              Submit
                            </Button>
                          )}
                          {q.status === 'approved' && (
                            <Button
                              size="sm"
                              className="rounded-lg h-8 gap-1 bg-sky-500 hover:bg-sky-600 text-white border-0"
                              onClick={() => handleSend(q._id)}
                              title="Send to customer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-lg h-8 w-8 p-0 text-content-muted"
                            onClick={() => setSelected(q)}
                            title="More"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-subtle bg-slate-50/50 dark:bg-slate-800/30">
          <p className="text-xs text-content-muted">
            Showing <span className="font-semibold text-content-primary">{from}</span> to{' '}
            <span className="font-semibold text-content-primary">{to}</span> of{' '}
            <span className="font-semibold text-content-primary">{total}</span> quotations
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-content-muted flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 rounded-lg border border-subtle bg-white dark:bg-slate-900 px-2 text-xs font-semibold"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-8"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg bg-[#5D5FEF] text-white text-xs font-bold px-2">
              {safePage}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-8"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </ExecutivePageShell>
      </div>

      <QuotationDetailDrawer
        quote={selected}
        open={!!selected && !showPdf}
        onClose={() => { setSelected(null); setShowPdf(false); }}
        onDownloadPdf={() => setShowPdf(true)}
        editHref={selected?._id ? `/sales-executive/quotations/${selected._id}/edit` : undefined}
        onFollowUp={(q) => {
          const leadId = q?.lead?._id || q?.lead;
          if (leadId) window.location.assign(`/sales-executive/follow-ups?leadId=${leadId}`);
          else window.location.assign('/sales-executive/follow-ups');
        }}
        onAddNote={(q) => {
          const leadId = q?.lead?._id || q?.lead;
          if (leadId) window.location.assign(`/sales-executive/leads/${leadId}/view`);
        }}
        actions={
          <>
            {selected?._id && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => navigate(`/sales-executive/quotations/${selected._id}/edit`)}
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Quotation
              </Button>
            )}
            {selected?.status === 'draft' ? (
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleSubmit(selected)}>
                Submit for Approval
              </Button>
            ) : selected?.status === 'approved' ? (
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { handleSend(selected._id); setSelected(null); }}>
                <Send className="w-3 h-3 mr-1" /> Send to Customer
              </Button>
            ) : null}
          </>
        }
      />

      <QuotationPdfOverlay
        quote={selected}
        open={showPdf}
        onClose={() => setShowPdf(false)}
        pdfRef={pdfRef}
      />

      {submitGate.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close"
            onClick={() =>
              !submitGate.submitting &&
              setSubmitGate({ open: false, quote: null, reason: '', needsReason: false, submitting: false })
            }
          />
          <div className="relative w-full max-w-md rounded-2xl border border-subtle bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-content-primary">Reason for re-submission</h3>
            <p className="mt-1 text-sm text-content-secondary">
              This lead already has a quotation on file. Please explain why you are submitting again
              for Team Leader / Manager approval.
            </p>
            <textarea
              value={submitGate.reason}
              onChange={(e) => setSubmitGate((s) => ({ ...s, reason: e.target.value }))}
              rows={4}
              maxLength={1000}
              placeholder="e.g. Customer requested hotel upgrade / revised travel dates…"
              className="mt-3 w-full rounded-xl border border-subtle bg-surface-elevated p-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={submitGate.submitting}
                onClick={() =>
                  setSubmitGate({ open: false, quote: null, reason: '', needsReason: false, submitting: false })
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitGate.submitting || !submitGate.reason.trim()}
                onClick={confirmSubmitGate}
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                {submitGate.submitting ? 'Submitting…' : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
