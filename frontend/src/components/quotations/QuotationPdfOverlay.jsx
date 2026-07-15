import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, X } from 'lucide-react';
import { Button } from '../ui/button';
import QuotePdfPreview from './QuotePdfPreview';
import { openQuotationPrintPreview, printQuotation } from './printQuotation';

export default function QuotationPdfOverlay({ quote, open, onClose, pdfRef: externalPdfRef, autoPrint = false, onAutoPrintDone }) {
  const internalRef = useRef(null);
  const pdfRef = externalPdfRef || internalRef;

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open || !autoPrint || !quote) return undefined;
    const timer = setTimeout(async () => {
      await printQuotation(pdfRef.current, quote.quoteNumber);
      onAutoPrintDone?.();
    }, 700);
    return () => clearTimeout(timer);
  }, [open, autoPrint, quote, pdfRef, onAutoPrintDone]);

  if (!open || !quote || typeof document === 'undefined') return null;

  const handlePrint = () => printQuotation(pdfRef.current, quote.quoteNumber);
  const handleOpenTab = () => { openQuotationPrintPreview(pdfRef.current, quote.quoteNumber); };

  return createPortal(
    <div className="quotation-print-root fixed inset-0 z-[210] bg-slate-600/90 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-3 flex flex-wrap justify-between items-center gap-2 shadow-lg">
        <Button variant="outline" onClick={onClose} className="rounded-xl gap-2 border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
          <X className="w-4 h-4" /> Close
        </Button>
        <p className="text-sm font-medium text-slate-300 hidden sm:block order-last sm:order-none w-full sm:w-auto text-center">
          {quote.quoteNumber} — Preview matches printed PDF
        </p>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={handleOpenTab} className="rounded-xl gap-2 border-slate-500 bg-slate-800 text-white hover:bg-slate-700 hidden sm:inline-flex">
            <ExternalLink className="w-4 h-4" /> Open Tab
          </Button>
          <Button onClick={handlePrint} className="rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md">
            <Download className="w-4 h-4" /> Save as PDF
          </Button>
        </div>
      </div>

      <div className="quote-pdf-preview-shell">
        <div className="quote-pdf-preview-paper">
          <QuotePdfPreview ref={pdfRef} quote={quote} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
