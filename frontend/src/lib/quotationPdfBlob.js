/**
 * Build a PDF Blob from a quotation preview DOM node (html2canvas + jsPDF).
 */
import { cloneWithEmbeddedImages, waitForImages } from '../components/quotations/embedPrintImages';

function safePdfFilename(quoteNumber) {
  return `Quotation-${String(quoteNumber || 'UNO').replace(/[^\w.\-]+/g, '_')}.pdf`;
}

export async function generateQuotationPdfBlob(contentEl, quoteNumber = 'UNO') {
  if (!contentEl) throw new Error('Quotation preview is not ready');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const embedded = (await cloneWithEmbeddedImages(contentEl)) || contentEl;
  await waitForImages(embedded, 8000);

  const canvas = await html2canvas(embedded, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: Math.max(embedded.scrollWidth || 794, 794),
  });

  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  const filename = safePdfFilename(quoteNumber);
  const blob = pdf.output('blob');
  return { blob, filename, pdf };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareOrDownloadQuotationPdf({ blob, filename, message, title }) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: title || filename,
        text: message || '',
      });
      return { shared: true, downloaded: false };
    } catch (err) {
      if (err?.name === 'AbortError') return { shared: false, downloaded: false, aborted: true };
    }
  }

  downloadBlob(blob, filename);
  return { shared: false, downloaded: true };
}

export function buildQuotationWhatsAppMessage({ lead, quote, userName } = {}) {
  const guest = lead?.name || quote?.lead?.name || 'Guest';
  const pkg =
    quote?.packageSnapshot?.name ||
    quote?.package?.name ||
    quote?.title ||
    '';
  const destination =
    quote?.packageSnapshot?.destination ||
    quote?.package?.destination ||
    lead?.destination ||
    '';
  const amount =
    quote?.pricing?.total ??
    quote?.costing?.grandTotal ??
    quote?.totalAmount ??
    null;
  const total =
    amount != null && Number(amount) > 0
      ? `₹${Number(amount).toLocaleString('en-IN')}`
      : null;
  const quoteNumber = quote?.quoteNumber || '';

  return [
    `Hello ${guest},`,
    '',
    'Your travel quotation from UNO Trips is ready.',
    '',
    pkg ? `📦 Package: ${pkg}` : null,
    destination ? `📍 Destination: ${destination}` : null,
    total ? `💰 Total: ${total}` : null,
    quoteNumber ? `🔖 Ref: ${quoteNumber}` : null,
    '',
    'Please find the quotation PDF attached / shared with this message.',
    'Reply here if you would like any changes.',
    '',
    `Thank you — ${userName || 'UNO Trips'}`,
  ]
    .filter(Boolean)
    .join('\n');
}
