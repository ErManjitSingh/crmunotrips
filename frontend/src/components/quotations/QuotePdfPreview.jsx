import { forwardRef } from 'react';
import './quotePdfTemplate.css';
import { COMPANY_INFO } from './constants';
import { formatINR } from './quotationUtils';
import { QUOTE_WELCOME_TEXT } from './quoteTemplateDefaults';
import { resolveDestinationImages } from './destinationGalleryUtils';
import {
  resolveQuotePackage,
  resolveQuoteLead,
  formatQuoteDate,
  formatQuoteDateShort,
  getDayDate,
  resolveQuoteVehicles,
  resolveDayHotelForItinerary,
  resolveTripPlanner,
  resolvePolicies,
  resolveBankAccounts,
  resolveTravelerCounts,
} from './quotePdfHelpers';

function PdfSection({ title, eyebrow, children, flush, spaced, className = '' }) {
  const sectionClass = [
    'quote-ht-section',
    spaced ? 'quote-ht-section-spaced' : '',
    flush ? 'quote-ht-section--flush' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section className={sectionClass}>
      {title && (
        <div className="quote-ht-section-title">
          {eyebrow && <span className="quote-ht-section-eyebrow">{eyebrow}</span>}
          <span className="quote-ht-section-heading">{title}</span>
        </div>
      )}
      <div className={`quote-ht-section-content ${flush ? 'quote-ht-section-content-flush' : ''}`.trim()}>
        {children}
      </div>
    </section>
  );
}

function PolicyBlock({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="quote-ht-policy">
      <div className="quote-ht-policy-head">{title}</div>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PdfImage({ src, alt, className }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      crossOrigin={src.startsWith('data:') ? undefined : 'anonymous'}
    />
  );
}

/** MakeMyTrip-style hotel voucher card — large photo + stay details */
function HotelStayCard({ dayHotel, dayMeals }) {
  if (!dayHotel?.name) return null;

  const hotelPhoto =
    dayHotel.hotelImages?.[0] ||
    dayHotel.thumbnailUrl ||
    dayHotel.images?.[0] ||
    dayHotel.roomImage ||
    dayHotel.roomImages?.[0];
  const mealPlan = dayHotel.meals || dayMeals || '—';
  const location = dayHotel.city || dayHotel.location || '—';
  const roomType = dayHotel.roomType || 'Deluxe';
  const rating = Number(dayHotel.rating || dayHotel.starCategory || 0);

  return (
    <div className="quote-ht-stay-card">
      <div className="quote-ht-stay-photo">
        {hotelPhoto ? (
          <PdfImage src={hotelPhoto} alt={dayHotel.name} className="quote-ht-stay-photo-img" />
        ) : (
          <div className="quote-ht-stay-photo-fallback">Stay</div>
        )}
        <span className="quote-ht-stay-photo-tag">Hotel</span>
      </div>
      <div className="quote-ht-stay-body">
        <div className="quote-ht-stay-label">Your Stay</div>
        <h4 className="quote-ht-stay-name">{dayHotel.name}</h4>
        {rating > 0 && (
          <div className="quote-ht-stay-rating">
            <span className="quote-ht-stay-stars">{'★'.repeat(Math.min(5, Math.round(rating)))}</span>
            <span className="quote-ht-stay-rating-val">{rating.toFixed(1)}</span>
          </div>
        )}
        <div className="quote-ht-stay-meta">
          <div className="quote-ht-stay-meta-item">
            <span className="quote-ht-stay-meta-label">Room</span>
            <span className="quote-ht-stay-meta-value">{roomType}</span>
          </div>
          <div className="quote-ht-stay-meta-item">
            <span className="quote-ht-stay-meta-label">Meal Plan</span>
            <span className="quote-ht-stay-meta-value">{mealPlan}</span>
          </div>
          <div className="quote-ht-stay-meta-item">
            <span className="quote-ht-stay-meta-label">Location</span>
            <span className="quote-ht-stay-meta-value">{location}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const QuotePdfPreview = forwardRef(function QuotePdfPreview({ quote }, ref) {
  if (!quote) return null;

  const lead = resolveQuoteLead(quote);
  const pkg = resolveQuotePackage(quote);
  const p = quote.pricing || {};
  const vehicles = resolveQuoteVehicles(quote);
  const planner = resolveTripPlanner(quote);
  const policies = resolvePolicies(quote);
  const banks = resolveBankAccounts(quote);
  const pax = resolveTravelerCounts(quote);
  const nights = Math.max(1, (pkg.duration || 1) - 1);
  const shortName = pkg.shortName || pkg.name?.split(' ').slice(0, 2).join(' ') || 'Package';
  const guestFirst = lead.name ? lead.name.split(' ')[0] : 'Guest';
  const destImages = resolveDestinationImages(quote);
  const coverSrc = pkg.coverImage || destImages[0]?.url || '';
  const destLabel =
    (pkg.routing || pkg.destination || '').split(/[,·]/)[0]?.trim() ||
    destImages[0]?.label ||
    'Your Trip';
  const highlightThumbs = destImages.slice(0, 3);
  const welcomePara = QUOTE_WELCOME_TEXT.split('\n\n')[0];

  return (
    <div ref={ref} className="quote-ht-pdf">
      {/* Slim brand bar */}
      <div className="quote-ht-topbar">
        <div className="quote-ht-brand-row">
          <img
            src={COMPANY_INFO.logoUrl}
            alt={COMPANY_INFO.name}
            className="quote-ht-logo-img"
            crossOrigin="anonymous"
          />
          <span className="quote-ht-brand-tagline">{COMPANY_INFO.tagline}</span>
        </div>
        <div className="quote-ht-quote-meta">
          <div className="qnum">{quote.quoteNumber}</div>
          <div>{formatQuoteDate(quote.createdAt)}</div>
        </div>
      </div>

      {/* Full-bleed cover — MakeMyTrip holiday style */}
      <div className="quote-ht-cover">
        {coverSrc ? (
          <PdfImage src={coverSrc} alt={destLabel} className="quote-ht-cover-img" />
        ) : (
          <div className="quote-ht-cover-fallback" />
        )}
        <div className="quote-ht-cover-shade" />
        <div className="quote-ht-cover-content">
          <span className="quote-ht-cover-badge">{shortName}</span>
          <h1 className="quote-ht-cover-title">{pkg.name}</h1>
          <p className="quote-ht-cover-route">{pkg.routing || pkg.destination}</p>
          <div className="quote-ht-cover-chips">
            <span>{nights}N / {pkg.duration}D</span>
            <span>{pkg.packageCategory}</span>
            {lead.travelDate && <span>{formatQuoteDate(lead.travelDate)}</span>}
          </div>
        </div>
        <div className="quote-ht-cover-price">
          <span className="price-label">Total Price</span>
          <span className="price-value">{formatINR(p.total)}</span>
          <span className="price-note">All inclusive</span>
        </div>
      </div>

      {/* Trip at a glance tiles */}
      <div className="quote-ht-glance">
        <div className="quote-ht-glance-item">
          <span className="quote-ht-glance-icon">G</span>
          <div>
            <span className="lbl">Guest</span>
            <span className="val">{lead.name || 'Guest'}</span>
          </div>
        </div>
        <div className="quote-ht-glance-item">
          <span className="quote-ht-glance-icon">T</span>
          <div>
            <span className="lbl">Travellers</span>
            <span className="val">
              {pax.adults}A{pax.kids ? ` · ${pax.kids}C` : ''}
            </span>
          </div>
        </div>
        <div className="quote-ht-glance-item">
          <span className="quote-ht-glance-icon">R</span>
          <div>
            <span className="lbl">Rooms</span>
            <span className="val">
              {pax.rooms}
              {pax.extraBeds ? ` +${pax.extraBeds} EB` : ''}
            </span>
          </div>
        </div>
        <div className="quote-ht-glance-item">
          <span className="quote-ht-glance-icon">C</span>
          <div>
            <span className="lbl">Cab</span>
            <span className="val">{pkg.cabCategory || vehicles[0]?.name || '—'}</span>
          </div>
        </div>
      </div>

      {/* Destination highlights strip */}
      {highlightThumbs.length > 1 && (
        <div className="quote-ht-highlights">
          {highlightThumbs.map((img) => (
            <figure key={img.url} className="quote-ht-highlight-card">
              <PdfImage src={img.url} alt={img.label} className="quote-ht-highlight-img" />
              <figcaption>{img.label}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Welcome */}
      <PdfSection title={`Hello ${guestFirst},`} eyebrow="Personal note" spaced>
        <div className="quote-ht-welcome">
          <p>{welcomePara}</p>
          <p className="quote-ht-welcome-contact">
            Need help anytime? <strong>{COMPANY_INFO.phone}</strong> · {COMPANY_INFO.email}
          </p>
        </div>
      </PdfSection>

      {/* Trip summary snapshot */}
      <PdfSection title="Trip Snapshot" eyebrow="Overview" spaced>
        <div className="quote-ht-snapshot">
          {[
            ['Package', pkg.name],
            ['Quotation', quote.quoteNumber],
            ['Route', pkg.routing || pkg.destination],
            ['Duration', `${pkg.duration} Days / ${nights} Nights`],
            ['Prepared for', lead.name || 'Guest'],
            ...(lead.phone ? [['Contact', lead.phone]] : []),
            ...(lead.travelDate ? [['Travel date', formatQuoteDate(lead.travelDate)]] : []),
            ['Category', pkg.packageCategory],
          ].map(([label, value]) => (
            <div key={label} className="quote-ht-snapshot-cell">
              <span className="lbl">{label}</span>
              <span className="val">{value}</span>
            </div>
          ))}
        </div>
      </PdfSection>

      {/* Transport */}
      {vehicles.length > 0 && (
        <PdfSection title="Transfers & Cab" eyebrow="Transport" spaced>
          <div className="quote-ht-transport-grid">
            {vehicles.map((v) => (
              <div key={v.name} className="quote-ht-transport-card">
                <div className="quote-ht-transport-icon">CAB</div>
                <div>
                  <div className="quote-ht-transport-name">{v.name}</div>
                  <div className="quote-ht-transport-meta">
                    {v.tripType ? v.tripType.replace(/_/g, ' ') : 'Private transfer'}
                    {v.startDate ? ` · ${formatQuoteDateShort(v.startDate)}` : ''}
                    {v.endDate ? ` → ${formatQuoteDateShort(v.endDate)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PdfSection>
      )}

      {/* Day-wise timeline itinerary */}
      {pkg.itinerary?.length > 0 && (
        <PdfSection title="Day-wise Itinerary" eyebrow="Your journey" spaced flush>
          <div className="quote-ht-timeline">
            {pkg.itinerary.map((day, index) => {
              const dayDate = getDayDate(lead.travelDate, day.day);
              const dayHotel = resolveDayHotelForItinerary(quote, day.day);
              const hasHotel = dayHotel?.name || day.hotel;
              const isLast = index === pkg.itinerary.length - 1;

              return (
                <div
                  key={day.id || day.day}
                  className={`quote-ht-timeline-item${isLast ? ' is-last' : ''}`}
                >
                  <div className="quote-ht-timeline-rail">
                    <span className="quote-ht-timeline-dot">{String(day.day).padStart(2, '0')}</span>
                    {!isLast && <span className="quote-ht-timeline-line" />}
                  </div>
                  <div className="quote-ht-timeline-card">
                    <div className="quote-ht-day-head">
                      <div>
                        <h3 className="quote-ht-day-title">{day.title}</h3>
                        <div className="quote-ht-day-date">
                          {dayDate ? formatQuoteDate(dayDate) : `Day ${day.day}`}
                          {(day.transport || pkg.cabCategory) && (
                            <span> · {day.transport || pkg.cabCategory}</span>
                          )}
                        </div>
                      </div>
                      {(dayHotel?.meals || day.meals) && (
                        <span className="quote-ht-meals-pill">
                          {dayHotel?.meals || day.meals}
                        </span>
                      )}
                    </div>

                    {day.description && (
                      <div className="quote-ht-day-body">{day.description}</div>
                    )}

                    {(day.sightseeing || day.activities || day.activityNotes) && (
                      <div className="quote-ht-day-extra">
                        {day.sightseeing && (
                          <div><strong>Sightseeing:</strong> {day.sightseeing}</div>
                        )}
                        {day.activities && (
                          <div><strong>Activities:</strong> {day.activities}</div>
                        )}
                        {day.activityNotes && (
                          <div className="quote-ht-day-note">{day.activityNotes}</div>
                        )}
                      </div>
                    )}

                    {hasHotel && (
                      <HotelStayCard
                        dayMeals={day.meals}
                        dayHotel={
                          dayHotel || {
                            name: day.hotel,
                            roomType: '',
                            meals: day.meals,
                            city: pkg.destination?.split(/[,·]/)[0]?.trim(),
                          }
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PdfSection>
      )}

      {/* Inclusions */}
      {(pkg.inclusions?.length || pkg.exclusions?.length) && (
        <PdfSection title="What's Included" eyebrow="Package cover" spaced>
          <div className="quote-ht-inc-exc">
            <div className="inc">
              <h4>Inclusions</h4>
              <ul>
                {(pkg.inclusions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="exc">
              <h4>Exclusions</h4>
              <ul>
                {(pkg.exclusions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </PdfSection>
      )}

      {/* Fare summary strip */}
      <div className="quote-ht-fare">
        <div className="quote-ht-fare-left">
          <span className="quote-ht-fare-label">Package fare</span>
          <span className="quote-ht-fare-sub">
            {nights}N · {pax.adults} Adult{pax.adults !== 1 ? 's' : ''}
            {pax.kids ? ` · ${pax.kids} Child` : ''}
          </span>
        </div>
        <div className="quote-ht-fare-right">
          <span className="quote-ht-fare-amount">{formatINR(p.total)}</span>
          <span className="quote-ht-fare-note">Taxes included as applicable</span>
        </div>
      </div>

      {/* Policies */}
      <PdfSection title="Policies & Terms" eyebrow="Please read" spaced>
        <div className="quote-ht-policies-wrap">
          <PolicyBlock title="Remarks" items={policies.remarks} />
          <PolicyBlock title="Terms & Conditions" items={policies.terms} />
          <PolicyBlock title="Confirmation Policy" items={policies.confirmation} />
          <PolicyBlock title="Cancellation Policy" items={policies.cancellation} />
          <PolicyBlock title="Amendment (Postpone & Prepone) Policy" items={policies.amendment} />
        </div>
      </PdfSection>

      {/* Bank */}
      <PdfSection title="Payment Details" eyebrow="Bank transfer" spaced>
        <table className="quote-ht-bank-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Bank</th>
              <th>Account Name</th>
              <th>Account No.</th>
              <th>IFSC</th>
              <th>Branch</th>
              <th>UPI</th>
            </tr>
          </thead>
          <tbody>
            {banks.map((b, i) => (
              <tr key={b.bank}>
                <td>{i + 1}</td>
                <td><strong>{b.bank}</strong></td>
                <td>{b.accountName}</td>
                <td>{b.accountNo}</td>
                <td>{b.ifsc}</td>
                <td>{b.branch}</td>
                <td>{b.upi || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      {/* Planner */}
      <PdfSection title="Need assistance?" eyebrow="Your trip expert" spaced>
        <div className="quote-ht-planner">
          <div className="quote-ht-planner-box">
            <h4>Trip Planner</h4>
            <div className="quote-ht-planner-name">{planner.name}</div>
            <div className="quote-ht-contact-line">
              {planner.phone || COMPANY_INFO.phone}
            </div>
          </div>
          <div className="quote-ht-planner-box">
            <h4>{COMPANY_INFO.name}</h4>
            <div>{COMPANY_INFO.address}</div>
            <div className="quote-ht-contact-line">{COMPANY_INFO.phone}</div>
            <div className="quote-ht-contact-line">{COMPANY_INFO.email}</div>
            <div className="quote-ht-contact-line">{COMPANY_INFO.website || 'unotrips.com'}</div>
          </div>
        </div>
      </PdfSection>

      <div className="quote-ht-footer">
        <img
          src={COMPANY_INFO.logoUrl}
          alt={COMPANY_INFO.name}
          className="quote-ht-footer-logo"
          crossOrigin="anonymous"
        />
        <p className="quote-ht-footer-price">
          Total Package Price: <strong>{formatINR(p.total)}</strong>
        </p>
        <p>{COMPANY_INFO.tagline}</p>
        <p>{COMPANY_INFO.phone} · {COMPANY_INFO.email}</p>
        <p className="quote-ht-footer-thanks">Thank you for choosing {COMPANY_INFO.name}</p>
      </div>
    </div>
  );
});

export default QuotePdfPreview;
