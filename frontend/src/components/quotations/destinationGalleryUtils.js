/**
 * Verified destination gallery URLs (Unsplash — auto=format avoids 404s).
 * Each entry: { url, label }
 */
export const DESTINATION_GALLERIES = {
  manali: [
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=720&q=70', label: 'Manali Himalayas' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=65', label: 'Solang Snow Valley' },
    { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=65', label: 'Mountain Valley' },
    { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=400&q=65', label: 'Kasol Forest Trail' },
  ],
  kashmir: [
    { url: 'https://images.unsplash.com/photo-1595815778869-8465134C4C70?auto=format&fit=crop&w=720&q=70', label: 'Dal Lake Srinagar' },
    { url: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=400&q=65', label: 'Mughal Gardens' },
    { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=65', label: 'Gulmarg Peaks' },
    { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=65', label: 'Pahalgam Valley' },
  ],
  dubai: [
    { url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=720&q=70', label: 'Dubai Skyline' },
    { url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=400&q=65', label: 'Burj Khalifa' },
    { url: 'https://images.unsplash.com/photo-1452780212940-6f903e5bb179?auto=format&fit=crop&w=400&q=65', label: 'Desert Safari' },
    { url: 'https://images.unsplash.com/photo-1582672060013-985110837a78?auto=format&fit=crop&w=400&q=65', label: 'Marina Cruise' },
  ],
  bali: [
    { url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=720&q=70', label: 'Bali Temple' },
    { url: 'https://images.unsplash.com/photo-1555404738-abb0f582a45c?auto=format&fit=crop&w=400&q=65', label: 'Rice Terraces' },
    { url: 'https://images.unsplash.com/photo-1518548419970-58e310bfcb41?auto=format&fit=crop&w=400&q=65', label: 'Seminyak Beach' },
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=65', label: 'Tropical Coast' },
  ],
  goa: [
    { url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=720&q=70', label: 'Goa Beaches' },
    { url: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=400&q=65', label: 'Coastal Sunset' },
    { url: 'https://images.unsplash.com/photo-1473496162514-89863c44af4f?auto=format&fit=crop&w=400&q=65', label: 'Beach Paradise' },
  ],
  default: [
    { url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=720&q=70', label: 'Scenic Destination' },
    { url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=400&q=65', label: 'Road Trip Views' },
    { url: 'https://images.unsplash.com/photo-1476514525535-07fb3f4f431b?auto=format&fit=crop&w=400&q=65', label: 'Lake & Mountains' },
    { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=400&q=65', label: 'Nature Escape' },
  ],
};

function matchGalleryKey(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('manali') || t.includes('solang') || t.includes('kasol') || t.includes('kullu')) return 'manali';
  if (t.includes('kashmir') || t.includes('srinagar') || t.includes('gulmarg') || t.includes('pahalgam')) return 'kashmir';
  if (t.includes('dubai') || t.includes('uae')) return 'dubai';
  if (t.includes('bali') || t.includes('ubud') || t.includes('seminyak')) return 'bali';
  if (t.includes('goa')) return 'goa';
  return 'default';
}

/** Merge populated package ref with quotation snapshot (snapshot wins for gallery fields). */
export function mergeQuotePackageData(quote) {
  const snap = quote?.packageSnapshot && typeof quote.packageSnapshot === 'object' ? quote.packageSnapshot : {};
  const pop = quote?.package && typeof quote.package === 'object' ? quote.package : {};
  return { ...pop, ...snap };
}

export function resolveDestinationImages(quote) {
  const normalize = (list) => list.slice(0, 4).map((img, i) => ({
    url: typeof img === 'string' ? img : img.url,
    label: typeof img === 'string' ? `View ${i + 1}` : (img.label || img.caption || `View ${i + 1}`),
  })).filter((img) => img.url);

  const pkg = mergeQuotePackageData(quote);

  if (pkg.destinationImages?.length) {
    return normalize(pkg.destinationImages);
  }

  const searchText = [pkg.routing, pkg.destination, pkg.name].filter(Boolean).join(' ');
  const key = matchGalleryKey(searchText);
  const stock = DESTINATION_GALLERIES[key] || DESTINATION_GALLERIES.default;

  if (pkg.coverImage) {
    const hero = {
      url: pkg.coverImage,
      label: pkg.destination?.split(/[,·]/)[0]?.trim() || 'Your Destination',
    };
    const rest = stock.filter((s) => s.url !== pkg.coverImage).slice(0, 3);
    return [hero, ...rest];
  }

  return stock;
}
