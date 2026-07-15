/**
 * Renders voucher HTML into a PDF and triggers browser download.
 */
export async function downloadVoucherPdf(html, filename = 'payment-voucher.pdf') {
  if (!html) throw new Error('Voucher HTML missing');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Voucher PDF');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win.document;

  try {
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise((resolve) => {
      if (doc.readyState === 'complete') {
        setTimeout(resolve, 400);
        return;
      }
      win.addEventListener('load', () => setTimeout(resolve, 400), { once: true });
      setTimeout(resolve, 2500);
    });

    const target = doc.body;
    // Compact page so voucher fits cleanly on A4
    target.style.margin = '0';
    target.style.padding = '16px';
    target.style.background = '#ffffff';

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
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

    const safeName = String(filename || 'payment-voucher.pdf')
      .replace(/[^\w.\-]+/g, '_')
      .replace(/\.pdf$/i, '')
      .concat('.pdf');
    pdf.save(safeName);
  } finally {
    iframe.remove();
  }
}

/**
 * Print voucher via hidden iframe (avoids popup blockers).
 */
export async function printVoucherHtml(html, title = 'Payment Voucher') {
  if (!html) throw new Error('Voucher HTML missing');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win.document;
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((resolve) => {
    if (doc.readyState === 'complete') {
      setTimeout(resolve, 400);
      return;
    }
    win.addEventListener('load', () => setTimeout(resolve, 400), { once: true });
    setTimeout(resolve, 2500);
  });

  try {
    win.focus();
    win.print();
  } finally {
    setTimeout(() => iframe.remove(), 1500);
  }
}
