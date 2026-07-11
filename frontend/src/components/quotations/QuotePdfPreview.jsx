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
  resolveQuoteHotels,
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

function DayHotelStay({ dayHotel }) {
  if (!dayHotel?.name) return null;
  const hotelPhoto = dayHotel.hotelImages?.[0] || dayHotel.thumbnailUrl;
  const roomPhoto = dayHotel.roomImage || dayHotel.roomImages?.[0];

  return (
    <div className="quote-ht-day-hotel">
      <div className="quote-ht-day-hotel-title">Accommodation</div>
      <div className="quote-ht-day-hotel-grid">
        {hotelPhoto && (
          <figure className="quote-ht-day-hotel-figure">
            <PdfImage src={hotelPhoto} alt={dayHotel.name} className="quote-ht-day-hotel-img" />
            <figcaption>Hotel — {dayHotel.name}</figcaption>
          </figure>
        )}
        {roomPhoto && (
          <figure className="quote-ht-day-hotel-figure">
            <PdfImage src={roomPhoto} alt={dayHotel.roomType} className="quote-ht-day-hotel-img" />
            <figcaption>Room — {dayHotel.roomType}</figcaption>
          </figure>
        )}
      </div>
      <div className="quote-ht-day-hotel-meta">
        <strong>{dayHotel.name}</strong>
        {dayHotel.roomType && <span> · {dayHotel.roomType}</span>}
        {dayHotel.meals && <span> · {dayHotel.meals}</span>}
        {dayHotel.city && <span> · {dayHotel.city}</span>}
      </div>
    </div>
  );
}

const QuotePdfPreview = forwardRef(function QuotePdfPreview({ quote }, ref) {
  if (!quote) return null;

  const lead = resolveQuoteLead(quote);
  const pkg = resolveQuotePackage(quote);
  const p = quote.pricing || {};
  const hotels = resolveQuoteHotels(quote);
  const vehicles = resolveQuoteVehicles(quote);
  const planner = resolveTripPlanner(quote);
  const policies = resolvePolicies(quote);
  const banks = resolveBankAccounts(quote);
  const pax = resolveTravelerCounts(quote);
  const nights = Math.max(1, (pkg.duration || 1) - 1);
  const shortName = pkg.shortName || pkg.name?.split(' ').slice(0, 2).join(' ') || 'Package';

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
          <div>{COMPANY_INFO.phone}</div>
          <div>{COMPANY_INFO.email}</div>
        </div>
      </div>

      {/* Package hero + destination */}
      <div className="quote-ht-header-block">
        <div className="quote-ht-package-hero">
          <div className="quote-ht-package-hero-main">
            <span className="pkg-code">{shortName}</span>
            <h2 className="pkg-title">{pkg.name}</h2>
            <div className="pkg-meta-row">
              <span className="pkg-chip pkg-chip-duration">
                {nights} Nights · {pkg.duration} Days
              </span>
              <span className="pkg-chip pkg-chip-route">
                {pkg.routing || pkg.destination}
              </span>
              <span className="pkg-chip pkg-chip-category">{pkg.packageCategory}</span>
            </div>
          </div>
          <div className="quote-ht-package-hero-price">
            <span className="price-label">Total Package Cost</span>
            <span className="price-value">{formatINR(p.total)}</span>
            <span className="price-note">Inclusive quote · {quote.quoteNumber}</span>
          </div>
        </div>

        <DestinationGallery
          quote={quote}
          destination={pkg.routing || pkg.destination}
          compact
        />
      </div>

      {/* Welcome */}
      <PdfSection title="Welcome">
        <div className="quote-ht-welcome">
          <strong>Hello {lead.name ? lead.name.split(' ')[0] : 'Guest'},</strong>
          <br />
          Welcome to {COMPANY_INFO.name}
          <br /><br />
          {QUOTE_WELCOME_TEXT.split('\n\n').map((para) => (
            <p key={para.slice(0, 24)}>{para}</p>
          ))}
          <p>
            For assistance call us 24/7: <strong>{COMPANY_INFO.phone}</strong>
          </p>
        </div>
      </PdfSection>

      {/* Package Overview */}
      <PdfSection title="Package Overview">
        <table className="quote-ht-overview">
          <tbody>
            {[
              ['Name of Package', `${pkg.name} [${quote.quoteNumber}]`],
              ['Quotation Date', formatQuoteDate(quote.createdAt)],
              ['Routing', pkg.routing || pkg.destination],
              ['Package Category', pkg.packageCategory],
              ['Duration', `${pkg.duration} Days & ${nights} Nights`],
              ['No. of Rooms', `${pax.rooms}${pax.extraBeds ? ` | Extra Bed: ${pax.extraBeds}` : ''}`],
              ['No. of Traveller', `Adult: ${pax.adults}${pax.kids ? ` | Kids: ${pax.kids}` : ''}`],
              ...(pkg.cabCategory || vehicles[0]?.name ? [['Cab Category', pkg.cabCategory || vehicles[0]?.name]] : []),
              ['Package Cost', `${formatINR(p.total)}/-`],
              ['Prepared For', lead.name || 'Guest'],
              ...(lead.phone ? [['Customer Phone', lead.phone]] : []),
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="label">{label}</td>
                <td className="value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PdfSection>

      {/* Package cost */}
      <PdfSection title="Package Cost">
        <table className="quote-ht-table quote-ht-table-nested">
          <thead>
            <tr>
              <th>Package Type</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="quote-ht-amount-row">
              <td style={{ fontWeight: 700 }}>{pkg.packageCategory}</td>
              <td style={{ textAlign: 'right' }}>{formatINR(p.total)}</td>
            </tr>
          </tbody>
        </table>
      </PdfSection>

      {/* Day-wise hotels */}
      {hotels.length > 0 && (
        <PdfSection title="Day-wise Hotel Details" spaced>
          <div className="quote-ht-hotel-days">
            {hotels.map((h) => {
              const hotelPhoto = h.hotelImages?.[0] || h.thumbnailUrl;
              const roomPhoto = h.roomImage || h.roomImages?.[0];
              return (
                <article key={`${h.day}-${h.name}-${h.date || ''}`} className="quote-ht-hotel-day-card">
                  <div className="quote-ht-hotel-day-head">
                    <span className="quote-ht-hotel-day-badge">Day {h.day}</span>
                    <span>{h.date ? formatQuoteDateShort(h.date) : (h.checkIn ? formatQuoteDateShort(h.checkIn) : '—')}</span>
                    <span>{h.city}</span>
                  </div>
                  <div className="quote-ht-hotel-day-body">
                    <div className="quote-ht-hotel-day-photos">
                      {hotelPhoto ? (
                        <figure className="quote-ht-hotel-day-photo">
                          <PdfImage src={hotelPhoto} alt={h.name} className="quote-ht-hotel-day-img" />
                          <figcaption>Hotel</figcaption>
                        </figure>
                      ) : null}
                      {roomPhoto ? (
                        <figure className="quote-ht-hotel-day-photo">
                          <PdfImage src={roomPhoto} alt={h.roomType} className="quote-ht-hotel-day-img" />
                          <figcaption>Room</figcaption>
                        </figure>
                      ) : null}
                    </div>
                    <div className="quote-ht-hotel-day-info">
                      <h4>{h.name}</h4>
                      {h.roomType && <p><strong>Room:</strong> {h.roomType}</p>}
                      {h.meals && <p><strong>Meals:</strong> {h.meals}</p>}
                      {h.price > 0 && <p className="quote-ht-hotel-day-price">{formatINR(h.price)}/night</p>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </PdfSection>
      )}

      {/* Vehicles */}
      {vehicles.length > 0 && (
        <PdfSection title="Vehicle Details" spaced>
          <table className="quote-ht-table quote-ht-table-nested">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Start Date</th>
                <th>End Date</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.name}>
                  <td>{v.name}</td>
                  <td>{v.startDate ? formatQuoteDateShort(v.startDate) : '—'}</td>
                  <td>{v.endDate ? formatQuoteDateShort(v.endDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PdfSection>
      )}

      {/* Day-wise itinerary */}
      {pkg.itinerary?.length > 0 && (
        <PdfSection title="Detailed Day Wise Itinerary" spaced flush>
          <div className="quote-ht-itinerary-list">
            {pkg.itinerary.map((day) => {
              const dayDate = getDayDate(lead.travelDate, day.day);
              const dayHotel = resolveDayHotelForItinerary(quote, day.day);
              return (
                <div key={day.id} className="quote-ht-day-card">
                  <div className="quote-ht-day-head">
                    <div className="day-title">
                      <span className="quote-ht-day-num">{day.day}</span>
                      <span>{day.title}</span>
                    </div>
                    <div className="quote-ht-day-meta">
                      {dayDate && (
                        <span className="quote-ht-meta-pill">
                          <span className="lbl">Date</span> {formatQuoteDate(dayDate)}
                        </span>
                      )}
                      {day.meals && (
                        <span className="quote-ht-meta-pill">
                          <span className="lbl">Meals</span> {day.meals}
                        </span>
                      )}
                      {(dayHotel?.name || day.hotel) && (
                        <span className="quote-ht-meta-pill">
                          <span className="lbl">Hotel</span> {dayHotel?.name || day.hotel}
                        </span>
                      )}
                      {(day.transport || pkg.cabCategory) && (
                        <span className="quote-ht-meta-pill">
                          <span className="lbl">Cab</span> {day.transport || pkg.cabCategory}
                        </span>
                      )}
                    </div>
                  </div>
                  {day.description && (
                    <div className="quote-ht-day-body">{day.description}</div>
                  )}
                  {(dayHotel || day.hotel) && (
                    <DayHotelStay
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
                  {(day.sightseeing || day.activities || day.activityNotes) && (
                    <div className="quote-ht-day-extra">
                      {day.sightseeing && (
                        <div><strong>Sightseeing for the day:</strong> {day.sightseeing}</div>
                      )}
                      {day.activities && (
                        <div><strong>Activities:</strong> {day.activities}</div>
                      )}
                      {day.activityNotes && (
                        <div style={{ marginTop: 4, fontStyle: 'italic' }}>{day.activityNotes}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PdfSection>
      )}

      {/* Inclusion & Exclusion */}
      {(pkg.inclusions?.length || pkg.exclusions?.length) && (
        <PdfSection title="Inclusion & Exclusion" spaced>
          <div className="quote-ht-inc-exc">
            <div className="inc">
              <h4>Inclusion</h4>
              <ul>
                {(pkg.inclusions || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="exc">
              <h4>Exclusion</h4>
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
      <PdfSection title="Bank Details — Cash / Cheque / Net Transfer" spaced>
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

      {/* Trip planner + contact */}
      <PdfSection title="Contact & Trip Planner" spaced>
        <div className="quote-ht-planner">
          <div className="quote-ht-planner-box">
            <h4>Trip Planner Details</h4>
            <div><strong>Name:</strong> {planner.name}</div>
            {planner.phone ? (
              <div><strong>Contact No.:</strong> {planner.phone}</div>
            ) : (
              <div><strong>Contact No.:</strong> {COMPANY_INFO.phone}</div>
            )}
          </div>
          <div className="quote-ht-planner-box">
            <h4>Address & Contact Info</h4>
            <div>{COMPANY_INFO.address}</div>
            <div className="quote-ht-contact-line">Phone: {COMPANY_INFO.phone}</div>
            <div className="quote-ht-contact-line">Email: {COMPANY_INFO.email}</div>
            <div className="quote-ht-contact-line">Web: {COMPANY_INFO.website || 'unotrips.com'}</div>
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
        <p>{COMPANY_INFO.tagline}</p>
        <p>{COMPANY_INFO.address}</p>
        <p>{COMPANY_INFO.phone} · {COMPANY_INFO.email}</p>
        <p style={{ marginTop: 8, opacity: 0.9 }}>Thank you for choosing {COMPANY_INFO.name}</p>
      </div>
    </div>
  );
});

export default QuotePdfPreview;
