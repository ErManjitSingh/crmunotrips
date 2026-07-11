import { forwardRef } from 'react';
import './quotePdfTemplate.css';
import { COMPANY_INFO } from './constants';
import { formatINR } from './quotationUtils';
import { QUOTE_WELCOME_TEXT } from './quoteTemplateDefaults';
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
import DestinationGallery from './DestinationGallery';

function PdfSection({ title, children, flush, spaced, className = '' }) {
  const sectionClass = [
    'quote-ht-section',
    spaced ? 'quote-ht-section-spaced' : '',
    flush ? 'quote-ht-section--flush' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section className={sectionClass}>
      {title && <div className="quote-ht-section-title">{title}</div>}
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

function HotelStayCard({ dayHotel, dayMeals }) {
  if (!dayHotel?.name) return null;

  const hotelPhoto = dayHotel.hotelImages?.[0] || dayHotel.thumbnailUrl;
  const roomPhoto = dayHotel.roomImage || dayHotel.roomImages?.[0];
  const viewPhoto = (dayHotel.hotelImages || []).slice(1, 2)[0];
  const mealPlan = dayHotel.meals || dayMeals || '—';
  const location = dayHotel.city || dayHotel.location || '—';
  const roomType = dayHotel.roomType || 'Deluxe';
  const rating = Number(dayHotel.rating || dayHotel.starCategory || 0);
  const reviewCount = dayHotel.reviewCount;

  const thumbs = [
    hotelPhoto && { src: hotelPhoto, label: 'Hotel', alt: dayHotel.name },
    roomPhoto && { src: roomPhoto, label: roomType, alt: roomType },
    viewPhoto && { src: viewPhoto, label: 'Hotel View', alt: dayHotel.name },
  ].filter(Boolean);

  return (
    <div className="quote-ht-stay-card">
      <div className="quote-ht-stay-loc">
        <span className="quote-ht-stay-loc-icon">📍</span>
        {location}
      </div>

      <div className="quote-ht-stay-main">
        <div className="quote-ht-stay-info">
          <div className="quote-ht-stay-brand">
            <span className="quote-ht-stay-icon-box">🏨</span>
            <div className="quote-ht-stay-text">
              <div className="quote-ht-stay-label">Your Stay</div>
              <h4 className="quote-ht-stay-name">{dayHotel.name}</h4>
              {rating > 0 && (
                <div className="quote-ht-stay-rating">
                  <span className="quote-ht-stay-stars">{'★'.repeat(Math.min(5, Math.round(rating)))}</span>
                  <span className="quote-ht-stay-rating-val">{rating.toFixed(1)}</span>
                  {reviewCount > 0 && (
                    <span className="quote-ht-stay-reviews">({reviewCount} reviews)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {thumbs.length > 0 && (
          <div className="quote-ht-stay-thumbs">
            {thumbs.map((thumb) => (
              <figure key={thumb.label + thumb.src} className="quote-ht-stay-thumb">
                <PdfImage src={thumb.src} alt={thumb.alt} className="quote-ht-stay-thumb-img" />
                <figcaption>{thumb.label}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      <div className="quote-ht-stay-chips">
        <div className="quote-ht-stay-chip">
          <span className="quote-ht-stay-chip-icon">🛏</span>
          <div>
            <span className="quote-ht-stay-chip-label">Room Type</span>
            <span className="quote-ht-stay-chip-value">{roomType}</span>
          </div>
        </div>
        <div className="quote-ht-stay-chip">
          <span className="quote-ht-stay-chip-icon">🍽</span>
          <div>
            <span className="quote-ht-stay-chip-label">Meal Plan</span>
            <span className="quote-ht-stay-chip-value">{mealPlan}</span>
          </div>
        </div>
        <div className="quote-ht-stay-chip">
          <span className="quote-ht-stay-chip-icon">📍</span>
          <div>
            <span className="quote-ht-stay-chip-label">Location</span>
            <span className="quote-ht-stay-chip-value">{location}</span>
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

  return (
    <div ref={ref} className="quote-ht-pdf">
      {/* Header */}
      <div className="quote-ht-topbar">
        <div className="quote-ht-brand-row">
          <img
            src={COMPANY_INFO.logoUrl}
            alt={COMPANY_INFO.name}
            className="quote-ht-logo-img"
            crossOrigin="anonymous"
          />
        </div>
        <div className="quote-ht-quote-meta">
          <div className="qnum">{quote.quoteNumber}</div>
          <div>{formatQuoteDate(quote.createdAt)}</div>
          <div>{COMPANY_INFO.phone}</div>
        </div>
      </div>

      {/* Hero */}
      <div className="quote-ht-header-block">
        <div className="quote-ht-package-hero">
          <div className="quote-ht-package-hero-main">
            <span className="pkg-code">{shortName}</span>
            <h2 className="pkg-title">{pkg.name}</h2>
            <div className="pkg-meta-row">
              <span className="pkg-chip pkg-chip-duration">
                {nights}N · {pkg.duration}D
              </span>
              <span className="pkg-chip pkg-chip-route">
                {pkg.routing || pkg.destination}
              </span>
              <span className="pkg-chip pkg-chip-category">{pkg.packageCategory}</span>
            </div>
          </div>
          <div className="quote-ht-package-hero-price">
            <span className="price-label">Total Package Price</span>
            <span className="price-value">{formatINR(p.total)}</span>
            <span className="price-note">All inclusive · Per quotation</span>
          </div>
        </div>

        <div className="quote-ht-guest-strip">
          <div className="quote-ht-guest-item">
            <span className="lbl">Guest</span>
            <span className="val">{lead.name || 'Guest'}</span>
          </div>
          <div className="quote-ht-guest-item">
            <span className="lbl">Travellers</span>
            <span className="val">
              {pax.adults} Adult{pax.adults !== 1 ? 's' : ''}
              {pax.kids ? ` · ${pax.kids} Kid${pax.kids !== 1 ? 's' : ''}` : ''}
            </span>
          </div>
          <div className="quote-ht-guest-item">
            <span className="lbl">Rooms</span>
            <span className="val">
              {pax.rooms}
              {pax.extraBeds ? ` + ${pax.extraBeds} Extra Bed` : ''}
            </span>
          </div>
          {(pkg.cabCategory || vehicles[0]?.name) && (
            <div className="quote-ht-guest-item">
              <span className="lbl">Cab</span>
              <span className="val">{pkg.cabCategory || vehicles[0]?.name}</span>
            </div>
          )}
        </div>

        <DestinationGallery
          quote={quote}
          destination={pkg.routing || pkg.destination}
          compact
        />
      </div>

      {/* Welcome */}
      <PdfSection title={`Welcome, ${guestFirst}`}>
        <div className="quote-ht-welcome">
          {QUOTE_WELCOME_TEXT.split('\n\n').map((para) => (
            <p key={para.slice(0, 24)}>{para}</p>
          ))}
          <p className="quote-ht-welcome-contact">
            24/7 Assistance: <strong>{COMPANY_INFO.phone}</strong> · {COMPANY_INFO.email}
          </p>
        </div>
      </PdfSection>

      {/* Package Overview — no price here */}
      <PdfSection title="Trip Summary" spaced>
        <table className="quote-ht-overview">
          <tbody>
            {[
              ['Package', pkg.name],
              ['Quotation No.', quote.quoteNumber],
              ['Travel Route', pkg.routing || pkg.destination],
              ['Category', pkg.packageCategory],
              ['Duration', `${pkg.duration} Days / ${nights} Nights`],
              ['Prepared For', lead.name || 'Guest'],
              ...(lead.phone ? [['Contact', lead.phone]] : []),
              ...(lead.travelDate ? [['Travel Date', formatQuoteDate(lead.travelDate)]] : []),
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="label">{label}</td>
                <td className="value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      {/* Vehicles */}
      {vehicles.length > 0 && (
        <PdfSection title="Transport" spaced>
          <table className="quote-ht-table quote-ht-table-nested">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Trip</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.name}>
                  <td><strong>{v.name}</strong></td>
                  <td>{v.tripType ? v.tripType.replace(/_/g, ' ') : '—'}</td>
                  <td>{v.startDate ? formatQuoteDateShort(v.startDate) : '—'}</td>
                  <td>{v.endDate ? formatQuoteDateShort(v.endDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PdfSection>
      )}

      {/* Itinerary with hotel cards */}
      {pkg.itinerary?.length > 0 && (
        <PdfSection title="Day Wise Itinerary" spaced flush>
          <div className="quote-ht-itinerary-list">
            {pkg.itinerary.map((day) => {
              const dayDate = getDayDate(lead.travelDate, day.day);
              const dayHotel = resolveDayHotelForItinerary(quote, day.day);
              const hasHotel = dayHotel?.name || day.hotel;

              return (
                <div key={day.id} className="quote-ht-day-card">
                  <div className="quote-ht-day-head">
                    <span className="quote-ht-day-badge">{String(day.day).padStart(2, '0')}</span>
                    <h3 className="quote-ht-day-title">{day.title}</h3>
                    {(dayHotel?.meals || day.meals) && (
                      <span className="quote-ht-meals-pill">
                        Meals: {dayHotel?.meals || day.meals}
                      </span>
                    )}
                  </div>

                  {dayDate && (
                    <div className="quote-ht-day-date">
                      {formatQuoteDate(dayDate)}
                      {(day.transport || pkg.cabCategory) && (
                        <span> · Cab: {day.transport || pkg.cabCategory}</span>
                      )}
                    </div>
                  )}

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
              );
            })}
          </div>
        </PdfSection>
      )}

      {/* Inclusion & Exclusion */}
      {(pkg.inclusions?.length || pkg.exclusions?.length) && (
        <PdfSection title="Inclusions & Exclusions" spaced>
          <div className="quote-ht-inc-exc">
            <div className="inc">
              <h4>Included</h4>
              <ul>
                {(pkg.inclusions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="exc">
              <h4>Not Included</h4>
              <ul>
                {(pkg.exclusions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </PdfSection>
      )}

      {/* Policies */}
      <PdfSection title="Policies & Terms" spaced>
        <div className="quote-ht-policies-wrap">
          <PolicyBlock title="Remarks" items={policies.remarks} />
          <PolicyBlock title="Terms & Conditions" items={policies.terms} />
          <PolicyBlock title="Confirmation Policy" items={policies.confirmation} />
          <PolicyBlock title="Cancellation Policy" items={policies.cancellation} />
          <PolicyBlock title="Amendment {Postpone & Prepone Policy}" items={policies.amendment} />
        </div>
      </PdfSection>

      {/* Bank details */}
      <PdfSection title="Payment — Bank Details" spaced>
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

      {/* Contact */}
      <PdfSection title="Your Trip Planner" spaced>
        <div className="quote-ht-planner">
          <div className="quote-ht-planner-box">
            <h4>Planner</h4>
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
