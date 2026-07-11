/**
 * Builds a self-contained HTML document for quotation print / PDF.
 * Uses inline template CSS so output always matches on-screen preview.
 */
import quotePdfCss from './quotePdfTemplate.css?inline';
import { cloneWithEmbeddedImages, waitForImages } from './embedPrintImages';

export function buildQuotationPrintDocument(contentHtml, title = 'Quotation') {
  const safeTitle = String(title || 'Quotation').replace(/[<>&"]/g, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
${quotePdfCss}
    @page { margin: 10mm 12mm; size: A4 portrait; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      overflow: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .quote-ht-section {
      orphans: 3;
      widows: 3;
    }
    .quote-ht-section-title + .quote-ht-section-content {
      page-break-before: avoid;
      break-before: avoid;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;
}

function waitForPrintDocument(doc, win) {
  return new Promise((resolve) => {
    const done = () => resolve();
    if (doc.readyState === 'complete') {
      setTimeout(done, 350);
      return;
    }
    win.addEventListener('load', () => setTimeout(done, 350), { once: true });
    setTimeout(done, 2000);
  });
}

/**
 * Print via hidden iframe — same HTML/CSS as preview, no popup blockers.
 */
export async function printQuotation(contentEl, title = 'Quotation') {
  if (!contentEl) {
    window.print();
    return;
  }

  const embedded = (await cloneWithEmbeddedImages(contentEl)) || contentEl;
  const html = buildQuotationPrintDocument(embedded.outerHTML, title);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Quotation Print');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win.document;
  doc.open();
  doc.write(html);
  doc.close();

  await waitForPrintDocument(doc, win);
  await waitForImages(doc.body, 5000);

  try {
    win.focus();
    win.print();
  } catch {
    /* ignore */
  }

  setTimeout(() => iframe.remove(), 1500);
}

/**
 * Open print preview in a new tab (same styling as screen preview).
 */
export async function openQuotationPrintPreview(contentEl, title = 'Quotation') {
  if (!contentEl) return null;

  const embedded = (await cloneWithEmbeddedImages(contentEl)) || contentEl;
  const html = buildQuotationPrintDocument(embedded.outerHTML, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank', 'noopener,noreferrer');
  if (!tab) {
    URL.revokeObjectURL(url);
    printQuotation(contentEl, title);
    return null;
  }
  tab.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  return tab;
}
