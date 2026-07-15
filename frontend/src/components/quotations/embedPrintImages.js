/** Wait for all images inside an element to load (or fail). */
export function waitForImages(root, timeoutMs = 8000) {
  if (!root) return Promise.resolve();
  const imgs = [...root.querySelectorAll('img')];
  if (!imgs.length) return Promise.resolve();

  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, timeoutMs);
        })
    )
  );
}

/** Print-safe max dimensions — keeps quotation PDF small. */
function getPrintImageLimits(img) {
  const cls = String(img?.className || '');
  if (cls.includes('quote-ht-cover-img')) return { maxW: 880, maxH: 520, quality: 0.7 };
  if (cls.includes('quote-ht-highlight-img')) return { maxW: 340, maxH: 200, quality: 0.65 };
  if (cls.includes('quote-ht-stay-photo-img')) return { maxW: 400, maxH: 320, quality: 0.68 };
  if (cls.includes('quote-ht-logo-img') || cls.includes('quote-ht-footer-logo')) {
    return { maxW: 220, maxH: 90, quality: 0.8 };
  }
  return { maxW: 640, maxH: 480, quality: 0.7 };
}

function scaleToFit(width, height, maxW, maxH) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const ratio = Math.min(1, maxW / w, maxH / h);
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
  };
}

/** Encode a drawn canvas as compressed JPEG data URL. */
function canvasToJpeg(canvas, quality = 0.7) {
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

/**
 * Resize + compress an HTMLImageElement for print/PDF embedding.
 * Full-resolution embeds were making quotation PDFs very heavy.
 */
export function imgElementToDataUrl(img, limits) {
  if (!img?.naturalWidth) return null;
  const { maxW, maxH, quality } = limits || getPrintImageLimits(img);
  const { width, height } = scaleToFit(img.naturalWidth, img.naturalHeight, maxW, maxH);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvasToJpeg(canvas, quality);
  } catch {
    return null;
  }
}

/** Load remote image into an Image element (CORS when possible). */
function loadImageElement(url) {
  return new Promise((resolve) => {
    const el = new Image();
    el.decoding = 'async';
    if (!String(url).startsWith('data:')) {
      el.crossOrigin = 'anonymous';
      el.referrerPolicy = 'no-referrer';
    }
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = url;
  });
}

/** Fetch/load image then compress through canvas for a light data URL. */
async function urlToCompressedDataUrl(url, limits) {
  if (!url) return null;

  if (String(url).startsWith('data:image/')) {
    const el = await loadImageElement(url);
    if (!el) return url.length < 120_000 ? url : null;
    return imgElementToDataUrl(el, limits) || (url.length < 120_000 ? url : null);
  }

  const el = await loadImageElement(url);
  if (el?.naturalWidth) {
    const compressed = imgElementToDataUrl(el, limits);
    if (compressed) return compressed;
  }

  // Last resort: raw fetch — still attempt canvas compress after blob load
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const blobImg = await loadImageElement(objectUrl);
      if (blobImg?.naturalWidth) {
        return imgElementToDataUrl(blobImg, limits);
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    /* ignore */
  }

  return null;
}

/** Clone quotation DOM and inline compressed image data URLs for print/PDF. */
export async function cloneWithEmbeddedImages(contentEl) {
  if (!contentEl) return null;

  await waitForImages(contentEl, 10000);

  const clone = contentEl.cloneNode(true);
  const srcImgs = contentEl.querySelectorAll('img');
  const cloneImgs = clone.querySelectorAll('img');

  for (let i = 0; i < cloneImgs.length; i += 1) {
    const srcImg = srcImgs[i];
    const cloneImg = cloneImgs[i];
    if (!srcImg || !cloneImg) continue;

    const limits = getPrintImageLimits(srcImg);
    let dataUrl = imgElementToDataUrl(srcImg, limits);
    if (!dataUrl && srcImg.src) {
      dataUrl = await urlToCompressedDataUrl(srcImg.src, limits);
    }
    if (dataUrl) {
      cloneImg.src = dataUrl;
      cloneImg.removeAttribute('srcset');
      cloneImg.removeAttribute('sizes');
    }
  }

  return clone;
}
