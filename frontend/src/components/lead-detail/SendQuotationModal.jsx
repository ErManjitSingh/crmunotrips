import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Phone, Plus, Send } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import QuotePdfPreview from '../quotations/QuotePdfPreview';
import { useAuth } from '../../context/AuthContext';
import { openWhatsApp } from '../../lib/whatsappContact';
import {
  buildQuotationWhatsAppMessage,
  generateQuotationPdfBlob,
  shareOrDownloadQuotationPdf,
} from '../../lib/quotationPdfBlob';
import { sendQuotationWhatsApp } from '../../services/quotationSendApi';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildPhoneOptions(lead) {
  const options = [];
  const seen = new Set();

  const push = (key, label, value) => {
    const d = digitsOnly(value);
    if (!d || d.length < 10) return;
    const normalized = d.length === 10 ? d : d.slice(-10);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    options.push({ key, label, value: normalized, display: `+91 ${normalized}` });
  };

  push('phone', 'Primary phone', lead?.phone);
  push('whatsapp', 'WhatsApp number', lead?.whatsapp);
  push('alternate', 'Alternate phone', lead?.alternatePhone);
  return options;
}

export default function SendQuotationModal({
  open,
  onClose,
  lead,
  leadId,
  quote,
  contactEndpoint = '/leads',
  onSent,
}) {
  const { user } = useAuth();
  const pdfRef = useRef(null);
  const phoneOptions = useMemo(() => buildPhoneOptions(lead), [lead]);
  const [mode, setMode] = useState('existing');
  const [selectedKey, setSelectedKey] = useState(phoneOptions[0]?.key || 'phone');
  const [customPhone, setCustomPhone] = useState('');
  const [saveAsAlternate, setSaveAsAlternate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(phoneOptions.length ? 'existing' : 'custom');
    setSelectedKey(phoneOptions[0]?.key || 'phone');
    setCustomPhone('');
    setSaveAsAlternate(true);
    setPreviewReady(false);
    const t = setTimeout(() => setPreviewReady(true), 600);
    return () => clearTimeout(t);
  }, [open, quote?._id, phoneOptions]);

  if (!quote) return null;

  const selectedPhone =
    mode === 'custom'
      ? digitsOnly(customPhone).slice(-10)
      : phoneOptions.find((o) => o.key === selectedKey)?.value || '';

  const message = buildQuotationWhatsAppMessage({
    lead,
    quote,
    userName: user?.name,
  });

  const handleSend = async () => {
    if (!leadId || !quote?._id) return;
    if (!selectedPhone || selectedPhone.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }
    if (!pdfRef.current || !previewReady) {
      toast.error('Preparing PDF… please wait a moment and try again');
      return;
    }

    setSubmitting(true);
    try {
      const { blob, filename } = await generateQuotationPdfBlob(
        pdfRef.current,
        quote.quoteNumber
      );

      await sendQuotationWhatsApp(
        leadId,
        {
          quotationId: quote._id,
          phone: selectedPhone,
          saveAsAlternate: mode === 'custom' && saveAsAlternate,
        },
        contactEndpoint
      );

      const shareResult = await shareOrDownloadQuotationPdf({
        blob,
        filename,
        message,
        title: `Quotation ${quote.quoteNumber || ''}`,
      });

      if (shareResult.aborted) {
        toast.info('Send cancelled');
        return;
      }

      if (!shareResult.shared) {
        const opened = openWhatsApp(selectedPhone, message);
        if (!opened) {
          toast.error('Could not open WhatsApp');
          return;
        }
        toast.success(
          shareResult.downloaded
            ? 'PDF downloaded. Attach it in WhatsApp and send.'
            : 'Opening WhatsApp…'
        );
      } else {
        toast.success('Quotation PDF shared');
      }

      onSent?.({ phone: selectedPhone, quote });
      onClose?.();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Could not send quotation';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal open={open} onClose={() => !submitting && onClose?.()} size="md" className="p-0 overflow-hidden">
      <div className="p-5 border-b border-subtle bg-gradient-to-r from-emerald-500/10 to-violet-500/5">
        <h3 className="text-lg font-bold text-content-primary flex items-center gap-2">
          <Send className="w-5 h-5 text-emerald-600" />
          Send Quotation
        </h3>
        <p className="text-sm text-content-muted mt-1">
          Send <span className="font-semibold text-content-primary">{quote.quoteNumber}</span> PDF
          to the customer on WhatsApp.
        </p>
      </div>

      <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-content-muted">Send to number</p>
          {phoneOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={submitting}
              onClick={() => {
                setMode('existing');
                setSelectedKey(opt.key);
              }}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
                mode === 'existing' && selectedKey === opt.key
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-subtle hover:border-emerald-500/30 hover:bg-emerald-500/5'
              )}
            >
              <span className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                {opt.key === 'whatsapp' ? <MessageCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-content-primary">{opt.label}</span>
                <span className="block text-xs text-content-muted tabular-nums">{opt.display}</span>
              </span>
            </button>
          ))}

          <button
            type="button"
            disabled={submitting}
            onClick={() => setMode('custom')}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors',
              mode === 'custom'
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-subtle hover:border-violet-500/30 hover:bg-violet-500/5'
            )}
          >
            <span className="w-9 h-9 rounded-lg bg-violet-500/15 text-violet-700 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-content-primary">Use another number</span>
              <span className="block text-xs text-content-muted">Add a different mobile for this send</span>
            </span>
          </button>
        </div>

        {mode === 'custom' && (
          <div className="space-y-3 rounded-xl border border-violet-200/60 bg-violet-50/50 dark:bg-violet-950/20 p-4">
            <label className="block text-xs font-bold text-content-primary">
              New mobile number
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex h-10 items-center rounded-lg border border-subtle bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-content-muted">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={customPhone}
                  onChange={(e) => setCustomPhone(digitsOnly(e.target.value).slice(0, 10))}
                  placeholder="10-digit mobile"
                  className="flex-1 h-10 rounded-lg border border-subtle bg-white dark:bg-slate-900 px-3 text-sm font-medium tabular-nums outline-none focus:ring-2 focus:ring-violet-400/40"
                />
              </div>
            </label>
            <label className="flex items-start gap-2 text-sm text-content-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsAlternate}
                onChange={(e) => setSaveAsAlternate(e.target.checked)}
                className="mt-1 rounded border-subtle"
              />
              <span>Save this number as alternate phone on the lead</span>
            </label>
          </div>
        )}

        <p className="text-xs text-content-muted leading-relaxed">
          CRM will generate the quotation PDF, open WhatsApp for{' '}
          <span className="font-semibold text-content-primary">
            {selectedPhone ? `+91 ${selectedPhone}` : 'the selected number'}
          </span>
          , and log this send on the activity timeline.
          {typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent)
            ? ' On mobile you can share the PDF file directly into WhatsApp.'
            : ' On desktop the PDF downloads so you can attach it in WhatsApp Web.'}
        </p>
      </div>

      <div className="px-5 py-4 border-t border-subtle flex flex-wrap justify-end gap-2 bg-surface-elevated/40">
        <Button type="button" variant="outline" disabled={submitting} onClick={onClose} className="rounded-xl">
          Cancel
        </Button>
        <Button
          type="button"
          disabled={submitting || !selectedPhone}
          onClick={handleSend}
          className="rounded-xl gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0"
        >
          <MessageCircle className="w-4 h-4" />
          {submitting ? 'Sending…' : 'Send on WhatsApp'}
        </Button>
      </div>

      {/* Off-screen preview used to generate PDF */}
      <div
        aria-hidden
        className="fixed left-[-12000px] top-0 w-[794px] pointer-events-none overflow-hidden"
      >
        <div className="quote-pdf-preview-paper bg-white">
          <QuotePdfPreview ref={pdfRef} quote={quote} />
        </div>
      </div>
    </AppModal>
  );
}
