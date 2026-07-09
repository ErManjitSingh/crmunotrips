function stripHtml(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function Section({ title, children }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-content-primary">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items, tone = 'default' }) {
  if (!items?.length) return null;
  const dot =
    tone === 'exclusion'
      ? 'bg-red-500'
      : tone === 'inclusion'
        ? 'bg-emerald-500'
        : 'bg-amber-500';
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-content-secondary leading-relaxed">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PackageDetailModal({ open, onClose, pkg, loading }) {
  if (!open) return null;

  const description = stripHtml(pkg?.description || pkg?.shortDescription || '');

  return (
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 flex max-h-[min(96vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-subtle bg-surface shadow-2xl">
        {loading ? (
          <div className="p-10 text-center text-content-muted animate-pulse">Loading package details…</div>
        ) : !pkg ? (
          <div className="p-10 text-center text-content-muted">Package not found.</div>
        ) : (
          <>
            <div className="relative h-48 sm:h-56 shrink-0 bg-surface-elevated">
              {pkg.coverImage ? (
                <img src={pkg.coverImage} alt={pkg.name} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-content-muted">No image</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white hover:bg-black/70"
              >
                Close
              </button>
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">{pkg.packageCode || pkg.packageType}</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">{pkg.name}</h2>
                <p className="text-sm text-white/85 mt-1">
                  {pkg.destination}
                  {pkg.state ? ` · ${pkg.state}` : ''}
                  {' · '}
                  {pkg.durationLabel}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-400/30">
                  From ₹{Number(pkg.startingPrice || 0).toLocaleString('en-IN')}
                </span>
                {pkg.isFeatured && (
                  <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700">Featured</span>
                )}
                {pkg.isCustomizable && (
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700">Customizable</span>
                )}
                {pkg.avgRating > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
                    ★ {pkg.avgRating} ({pkg.reviewCount} reviews)
                  </span>
                )}
              </div>

              {description && (
                <Section title="About this package">
                  <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-line">{description}</p>
                </Section>
              )}

              {pkg.galleryImages?.length > 0 && (
                <Section title="Gallery">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {pkg.galleryImages.map((src) => (
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className="h-24 w-full rounded-xl object-cover border border-subtle"
                        loading="lazy"
                      />
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Day-wise itinerary">
                {pkg.itinerary?.length ? (
                  <div className="space-y-3">
                    {pkg.itinerary.map((day) => (
                      <div key={day.id || day.day} className="rounded-xl border border-subtle p-4 bg-surface-elevated/50">
                        <div className="flex gap-3">
                          {day.dayImage && (
                            <img src={day.dayImage} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" loading="lazy" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-amber-600">Day {day.day}</p>
                            <p className="text-sm font-semibold text-content-primary">{day.title}</p>
                            <p className="text-sm text-content-secondary mt-1 whitespace-pre-line">{day.description}</p>
                            {(day.meals || day.transport) && (
                              <p className="text-xs text-content-muted mt-2">
                                {[day.meals && `Meals: ${day.meals}`, day.transport && `Transport: ${day.transport}`]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-content-muted">Itinerary not available.</p>
                )}
              </Section>

              <div className="grid sm:grid-cols-2 gap-6">
                <Section title="Inclusions">
                  <BulletList items={pkg.inclusions} tone="inclusion" />
                </Section>
                <Section title="Exclusions">
                  <BulletList items={pkg.exclusions} tone="exclusion" />
                </Section>
              </div>

              <Section title="Remarks">
                <BulletList items={pkg.remarks} />
              </Section>

              <Section title="Terms & conditions">
                <BulletList items={pkg.termsConditions} />
              </Section>

              <Section title="Cancellation policy">
                <BulletList items={pkg.cancellationPolicy} />
              </Section>

              {pkg.faqs?.length > 0 && (
                <Section title="FAQs">
                  <div className="space-y-3">
                    {pkg.faqs.map((faq, i) => (
                      <div key={i} className="rounded-xl border border-subtle p-3">
                        <p className="text-sm font-semibold text-content-primary">{faq.question}</p>
                        <p className="text-sm text-content-secondary mt-1 whitespace-pre-line">{stripHtml(faq.answer)}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
