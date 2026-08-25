import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Pencil, Send } from 'lucide-react';
import { ACTIVITY_CONFIG, findQuotationForActivity } from './leadDetailData';
import QuotationPdfOverlay from '../quotations/QuotationPdfOverlay';
import SendQuotationModal from './SendQuotationModal';
import EmailSentViewModal from './EmailSentViewModal';
import { Button } from '../ui/button';
import { DETAIL_CARD } from './leadDetailUtils';
import { cn } from '../../lib/utils';

function formatActivityDate(iso) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function resolveQuoteEditHref(quoteId, contactEndpoint = '') {
  if (!quoteId) return null;
  const base = String(contactEndpoint || '');
  if (base.includes('sales-executive')) {
    return `/sales-executive/quotations/${quoteId}/edit`;
  }
  if (base.includes('sales-manager')) {
    return `/sales-manager/quotations/new?edit=${quoteId}`;
  }
  if (base.includes('team-leader')) {
    return `/team-leader/quotations/new?edit=${quoteId}`;
  }
  return `/quotations/new?edit=${quoteId}`;
}

function parseChangesFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return [];
  return notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const arrow = line.match(/^(.+?):\s*(.*?)\s*→\s*(.*)$/);
      if (!arrow) return null;
      return {
        label: arrow[1].trim(),
        from: arrow[2].trim() || '—',
        to: arrow[3].trim() || '—',
      };
    })
    .filter(Boolean);
}

function ActivityChangeList({ changes }) {
  if (!changes?.length) return null;
  return (
    <ul className="mt-2 space-y-1 rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
      {changes.map((change, idx) => (
        <li
          key={`${change.field || change.label || 'f'}-${idx}`}
          className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300"
        >
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {change.label || change.field || 'Field'}
          </span>
          <span className="text-slate-400">:</span>
          <span className="line-through decoration-slate-300 text-slate-400">
            {change.from ?? String(change.oldValue ?? '—')}
          </span>
          <span className="text-slate-400">→</span>
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {change.to ?? String(change.newValue ?? '—')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuoteMetaChips({ item, quote }) {
  const amount = item.meta?.amount ?? quote?.pricing?.total ?? quote?.costing?.grandTotal;
  const quoteNumber = item.meta?.quoteNumber || quote?.quoteNumber;
  const status = item.meta?.status || quote?.status;

  if (!quoteNumber && amount == null && !status) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {quoteNumber && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#5D5FEF]/10 text-[11px] font-bold text-[#5D5FEF]">
          {quoteNumber}
        </span>
      )}
      {amount != null && Number(amount) > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-[11px] font-bold text-emerald-700 tabular-nums">
          ₹{Number(amount).toLocaleString('en-IN')}
        </span>
      )}
      {status && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 capitalize">
          {String(status).replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}

export default function LeadActivityTimeline({
  activities,
  loading = false,
  quotations = [],
  highlightQuotationId = null,
  lead = null,
  leadId = null,
  contactEndpoint = '/leads',
  onQuotationSent,
}) {
  const [pdfQuote, setPdfQuote] = useState(null);
  const [sendQuote, setSendQuote] = useState(null);
  const [viewEmail, setViewEmail] = useState(null);
  const pdfRef = useRef(null);
  const highlightRef = useRef(null);
  const sorted = useMemo(() => {
    if (!Array.isArray(activities) || activities.length === 0) return [];
    // Upstream merge is newest-first; only re-sort if needed
    let needsSort = false;
    for (let i = 1; i < activities.length; i += 1) {
      if (new Date(activities[i - 1].date) < new Date(activities[i].date)) {
        needsSort = true;
        break;
      }
    }
    if (!needsSort) return activities;
    return [...activities].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [activities]);

  useEffect(() => {
    if (!highlightQuotationId || !highlightRef.current) return undefined;
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    return () => clearTimeout(t);
  }, [highlightQuotationId, sorted.length]);

  return (
    <>
      <div id="lead-activity-timeline" className={`${DETAIL_CARD} overflow-hidden scroll-mt-24`}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activity Timeline</h3>
        </div>
        <div className="p-5">
          {loading && (
            <p className="text-sm text-slate-400 text-center py-6">Loading timeline...</p>
          )}
          {!loading && sorted.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No activity yet</p>
          )}
          {!loading && sorted.length > 0 && (
            <div>
              {sorted.length > 8 && (
                <p className="mb-2 text-[11px] font-medium text-slate-400">
                  Showing 8 at a time · scroll for {sorted.length - 8} more
                </p>
              )}
              <div className="relative max-h-[36rem] overflow-y-auto overscroll-contain pr-1">
                <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-violet-300 via-slate-200 to-transparent dark:from-violet-800 dark:via-slate-700" />
                <div className="space-y-1">
                  {sorted.map((item, i) => {
                  const cfg = ACTIVITY_CONFIG[item.type] || ACTIVITY_CONFIG.status_changed;
                  const Icon = cfg.icon;
                  const { date, time } = formatActivityDate(item.date);
                  const isQuote = item.type?.startsWith('quotation_');
                  const isEmailSent = item.type === 'email_sent';
                  const emailLogId = item.meta?.emailLogId || null;
                  const quote = isQuote ? findQuotationForActivity(item, quotations) : null;
                  const quoteId = quote?._id || item.meta?.quotationId || null;
                  const editHref = isQuote ? resolveQuoteEditHref(quoteId, contactEndpoint) : null;
                  const canView = Boolean(quote?._id && (quote.pricing || quote.packageSnapshot));
                  const canViewEmail = Boolean(emailLogId);
                  const canSend =
                    canView &&
                    lead &&
                    leadId &&
                    !['draft', 'pending_approval', 'rejected'].includes(quote?.status);
                  const isHighlight =
                    highlightQuotationId &&
                    (String(item.meta?.quotationId) === String(highlightQuotationId) ||
                      String(quote?._id) === String(highlightQuotationId));

                  return (
                    <motion.div
                      key={item.id}
                      ref={isHighlight ? highlightRef : undefined}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.04 }}
                      className={cn(
                        'relative flex gap-4 py-3 group rounded-xl transition-colors',
                        isHighlight && 'bg-violet-50/80 dark:bg-violet-950/30 ring-1 ring-[#5D5FEF]/25 px-2 -mx-2'
                      )}
                    >
                      <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 pb-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title || cfg.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              <span className="font-medium text-slate-600 dark:text-slate-300">{item.user}</span>
                              {' · '}{date} at {time}
                            </p>
                          </div>
                          {isQuote && (editHref || canView || canSend) && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {editHref && (
                                <Link
                                  to={editHref}
                                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </Link>
                              )}
                              {canView && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPdfQuote(quote)}
                                  className="rounded-lg h-7 gap-1 text-[11px] text-sky-700 border-sky-200 bg-sky-50 hover:bg-sky-100"
                                >
                                  <Eye className="w-3 h-3" /> View
                                </Button>
                              )}
                              {canSend && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setSendQuote(quote)}
                                  className="rounded-lg h-7 gap-1 text-[11px] bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0"
                                >
                                  <Send className="w-3 h-3" /> Send to customer
                                </Button>
                              )}
                            </div>
                          )}
                          {isEmailSent && canViewEmail && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setViewEmail({
                                  emailLogId,
                                  subject: item.notes || item.title || item.meta?.subject || 'Sent email',
                                })
                              }
                              className="rounded-lg h-7 gap-1 text-[11px] text-sky-700 border-sky-200 bg-sky-50 hover:bg-sky-100"
                            >
                              <Eye className="w-3 h-3" /> View
                            </Button>
                          )}
                        </div>
                        {isQuote && <QuoteMetaChips item={item} quote={quote} />}
                        {(() => {
                          const metaChanges = Array.isArray(item.meta?.changes) ? item.meta.changes : [];
                          const parsed = metaChanges.length ? metaChanges : parseChangesFromNotes(item.notes);
                          if (parsed.length) return <ActivityChangeList changes={parsed} />;
                          if (
                            item.notes &&
                            /lead details updated/i.test(item.notes) &&
                            !item.notes.includes('→')
                          ) {
                            return (
                              <p className="mt-2 text-[11px] text-slate-400">
                                Field-level details were not stored for this older edit. New edits will show each changed field.
                              </p>
                            );
                          }
                          if (item.notes) {
                            return (
                              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 whitespace-pre-line">
                                {item.notes}
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </motion.div>
                  );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuotationPdfOverlay
        quote={pdfQuote}
        open={!!pdfQuote}
        onClose={() => setPdfQuote(null)}
        pdfRef={pdfRef}
      />

      <SendQuotationModal
        open={!!sendQuote}
        onClose={() => setSendQuote(null)}
        lead={lead}
        leadId={leadId}
        quote={sendQuote}
        contactEndpoint={contactEndpoint}
        onSent={onQuotationSent}
      />

      <EmailSentViewModal
        open={!!viewEmail}
        onClose={() => setViewEmail(null)}
        emailLogId={viewEmail?.emailLogId}
        fallbackSubject={viewEmail?.subject || ''}
      />
    </>
  );
}
