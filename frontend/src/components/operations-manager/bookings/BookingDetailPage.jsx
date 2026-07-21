import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Ticket, Phone, Mail, Loader2,
  FileText, ListTodo, MapPin, Users, Wallet, ExternalLink,
  Hotel, Car, Receipt, IndianRupee, ClipboardCheck,
} from 'lucide-react';
import API from '../../../api/axios';
import PageHeader from '../../ui/PageHeader';
import { Button } from '../../ui/button';
import BookingStatusBadge from './BookingStatusBadge';
import { formatINR, formatDate, formatPax, formatTravelRange } from '../operationsUtils';
import { cn } from '../../../lib/utils';
import {
  QuotationSyncBanner,
  BookingHotelsEditor,
  BookingTransportEditor,
  BookingItineraryTimeline,
} from './BookingFulfillmentSections';

const DOC_TYPES = [
  { value: 'customer_id', label: 'Customer ID' },
  { value: 'hotel_confirmation', label: 'Hotel Confirmation' },
  { value: 'flight_ticket', label: 'Flight Ticket' },
  { value: 'bus_ticket', label: 'Bus Ticket' },
  { value: 'travel_insurance', label: 'Travel Insurance' },
  { value: 'other', label: 'Other' },
];

const TASK_STATUS = {
  pending: 'bg-amber-500/15 text-amber-700',
  in_progress: 'bg-sky-500/15 text-sky-700',
  completed: 'bg-emerald-500/15 text-emerald-700',
};

function openReceipt(receiptHtml) {
  if (!receiptHtml) return;
  const url = URL.createObjectURL(new Blob([receiptHtml], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function BookingSnapshot({ booking, amount, quoteMeta }) {
  const cards = [
    {
      icon: MapPin,
      label: 'Lead / Destination',
      value: booking.destination || '—',
      detail: `${booking.customerName} · ${booking.customerPhone || 'No phone'}`,
      color: 'text-sky-600 bg-sky-500/10',
    },
    {
      icon: FileText,
      label: 'Customer Quotation',
      value: quoteMeta?.quoteNumber || booking.quotationReference || 'Not linked',
      detail: `${quoteMeta?.packageName || booking.packageName || 'Custom package'} · ${quoteMeta?.quoteStatus || '—'}`,
      color: 'text-violet-600 bg-violet-500/10',
    },
    {
      icon: IndianRupee,
      label: 'Payment Received',
      value: formatINR(booking.advanceReceived),
      detail: `${formatINR(booking.pendingAmount)} balance of ${formatINR(amount)}`,
      color: 'text-emerald-600 bg-emerald-500/10',
    },
    {
      icon: ClipboardCheck,
      label: 'Fulfillment',
      value: `${booking.hotels?.length || 0} hotels · ${booking.transport?.length || 0} cabs`,
      detail: `${booking.itinerary?.length || 0} itinerary days · ${booking.vouchers?.length || 0} vouchers`,
      color: 'text-amber-600 bg-amber-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, detail, color }) => (
        <div key={label} className="rounded-2xl border border-subtle bg-surface/90 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className={cn('rounded-xl p-2.5', color)}><Icon className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">{label}</p>
              <p className="mt-1 truncate text-sm font-black text-content-primary">{value}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-content-secondary">{detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuotationSummary({ meta }) {
  if (!meta?.quoteNumber) return null;
  const inclusions = Array.isArray(meta.inclusions) ? meta.inclusions : [];
  const exclusions = Array.isArray(meta.exclusions) ? meta.exclusions : [];
  return (
    <div className="rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Quotation sent to customer</p>
          <h3 className="mt-1 text-lg font-black text-content-primary">{meta.quoteNumber} · {meta.packageName || 'Custom Package'}</h3>
        </div>
        <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-bold capitalize text-violet-700">{meta.quoteStatus}</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold text-emerald-700">Included</p>
          <div className="space-y-1.5">
            {(inclusions.length ? inclusions : ['As per day-wise itinerary']).slice(0, 8).map((item, index) => (
              <p key={`${item}-${index}`} className="text-xs text-content-secondary">✓ {typeof item === 'string' ? item : item?.label || item?.name}</p>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold text-rose-700">Excluded</p>
          <div className="space-y-1.5">
            {(exclusions.length ? exclusions : ['Anything not mentioned in inclusions']).slice(0, 8).map((item, index) => (
              <p key={`${item}-${index}`} className="text-xs text-content-secondary">× {typeof item === 'string' ? item : item?.label || item?.name}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function applyBookingState(data, setters) {
  const {
    setBooking, setItinerary, setHotels, setTransport,
  } = setters;
  setBooking(data);
  setItinerary(data.itinerary?.length ? data.itinerary : [{ day: 1, title: '', description: '' }]);
  setHotels(data.hotels?.length ? data.hotels : []);
  setTransport(data.transport?.length ? data.transport : []);
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [itinerary, setItinerary] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [transport, setTransport] = useState([]);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [savingHotels, setSavingHotels] = useState(false);
  const [savingTransport, setSavingTransport] = useState(false);
  const [syncingQuote, setSyncingQuote] = useState(false);
  const [docForm, setDocForm] = useState({ type: 'hotel_confirmation', fileName: '', fileUrl: '' });
  const [addingDoc, setAddingDoc] = useState(false);
  const [itineraryPdfUrl, setItineraryPdfUrl] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [catalogHotels, setCatalogHotels] = useState([]);
  const [catalogCabs, setCatalogCabs] = useState([]);
  const [sendingVoucher, setSendingVoucher] = useState(null);

  const setters = { setBooking, setItinerary, setHotels, setTransport };

  const fetchBooking = () => {
    setLoading(true);
    API.get(`/operations-manager/bookings/${id}`)
      .then((r) => applyBookingState(r.data, setters))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBooking(); }, [id]);

  useEffect(() => {
    Promise.all([
      API.get('/operations-manager/hotels', { params: { limit: 500 }, skipSuccessToast: true }),
      API.get('/operations-manager/transport', { params: { catalog: true }, skipSuccessToast: true }),
    ]).then(([hotelsRes, transportRes]) => {
      setCatalogHotels(hotelsRes.data?.data ?? hotelsRes.data ?? []);
      setCatalogCabs(transportRes.data?.cabs || []);
    }).catch(() => {});
  }, []);

  const syncFromQuotation = async () => {
    setSyncingQuote(true);
    try {
      const r = await API.post(`/operations-manager/bookings/${id}/sync-quotation`, { force: true });
      applyBookingState(r.data, setters);
    } finally {
      setSyncingQuote(false);
    }
  };

  const saveItinerary = async () => {
    setSavingItinerary(true);
    await API.put(`/operations-manager/bookings/${id}`, { itinerary });
    fetchBooking();
    setSavingItinerary(false);
  };

  const saveHotels = async () => {
    setSavingHotels(true);
    await API.put(`/operations-manager/bookings/${id}`, { hotels });
    fetchBooking();
    setSavingHotels(false);
  };

  const saveTransport = async () => {
    setSavingTransport(true);
    await API.put(`/operations-manager/bookings/${id}`, { transport });
    fetchBooking();
    setSavingTransport(false);
  };

  const confirmHotel = async () => {
    setActionLoading('hotel');
    await API.post(`/operations-manager/bookings/${id}/confirm-hotel`);
    fetchBooking();
    setActionLoading(null);
  };

  const confirmCab = async () => {
    setActionLoading('cab');
    await API.post(`/operations-manager/bookings/${id}/confirm-cab`);
    fetchBooking();
    setActionLoading(null);
  };

  const updateStatus = async (status) => {
    setActionLoading(status);
    await API.put(`/operations-manager/bookings/${id}`, { status });
    fetchBooking();
    setActionLoading(null);
  };

  const addDocument = async (e) => {
    e.preventDefault();
    if (!docForm.fileUrl.trim()) return;
    setAddingDoc(true);
    await API.post(`/operations-manager/bookings/${id}/documents`, docForm);
    setDocForm({ type: 'hotel_confirmation', fileName: '', fileUrl: '' });
    fetchBooking();
    setAddingDoc(false);
  };

  const updateTaskStatus = async (taskId, status) => {
    await API.patch(`/operations-manager/tasks/${taskId}`, { status });
    fetchBooking();
  };

  const generateItineraryPdf = async () => {
    setGeneratingPdf(true);
    try {
      const r = await API.post(`/operations-manager/bookings/${id}/itinerary-pdf`);
      const url = r.data?.pdfUrl;
      setItineraryPdfUrl(url);
      if (url) window.open(url, '_blank');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const sendHotelVoucher = async (hotel) => {
    if (!hotel?._id || !hotel.email) return;
    setSendingVoucher(hotel._id);
    try {
      await API.put(`/operations-manager/bookings/${id}`, { hotels });
      await API.post(`/operations-manager/bookings/${id}/hotels/${hotel._id}/voucher/send`, {
        email: hotel.email,
        phone: hotel.phone,
        contactPerson: hotel.contactPerson,
        confirmationNumber: hotel.confirmationNumber,
      });
      fetchBooking();
    } finally {
      setSendingVoucher(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-content-muted">Loading trip fulfillment...</p>
      </div>
    );
  }

  if (!booking) return <div className="text-center py-20 text-content-muted">Booking not found</div>;

  const amount = booking.totalAmount ?? booking.amount ?? 0;
  const quoteMeta = booking.quotationMeta || booking.quotationPreview?.meta;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Link to="/operations-manager/bookings/pending" className="p-2.5 rounded-xl border border-subtle hover:bg-surface-elevated transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <PageHeader
          title={booking.bookingNumber}
          description={`${booking.customerName} · ${booking.destination}`}
          breadcrumbs={['Operations', 'Bookings', booking.bookingNumber]}
        />
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-teal-500/15 bg-gradient-to-br from-teal-600/15 via-cyan-500/10 to-violet-500/10 p-6 sm:p-8"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <BookingStatusBadge status={booking.status} />
            <h1 className="text-2xl sm:text-3xl font-black text-content-primary mt-3 tracking-tight">
              {booking.packageName || booking.destination}
            </h1>
            <p className="text-sm text-content-secondary mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{booking.destination}</span>
              <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" />{formatPax(booking)}</span>
              <span>{formatTravelRange(booking)}</span>
            </p>
            <p className="text-xs text-content-muted mt-2">
              Quote {booking.quotationReference || '—'} · Executive {booking.executiveName || '—'}
            </p>
          </div>
          <div className="text-left lg:text-right shrink-0">
            <p className="text-3xl sm:text-4xl font-black text-teal-600 tabular-nums">{formatINR(amount)}</p>
            <p className="text-xs text-content-muted capitalize mt-1">Payment: {booking.paymentStatus || 'pending'}</p>
            <p className="text-sm text-amber-600 font-semibold mt-1">Pending {formatINR(booking.pendingAmount)}</p>
          </div>
        </div>
      </motion.div>

      <BookingSnapshot booking={booking} amount={amount} quoteMeta={quoteMeta} />

      <QuotationSyncBanner
        meta={quoteMeta}
        autoSynced={booking.autoSyncedFromQuotation}
        syncing={syncingQuote}
        onSync={syncFromQuotation}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          <QuotationSummary meta={quoteMeta} />

          <BookingItineraryTimeline
            itinerary={itinerary}
            onChange={setItinerary}
            onSave={saveItinerary}
            saving={savingItinerary}
            onPdf={generateItineraryPdf}
            generatingPdf={generatingPdf}
            pdfUrl={itineraryPdfUrl}
            catalogHotels={catalogHotels}
            catalogCabs={catalogCabs}
          />

          <BookingHotelsEditor
            hotels={hotels}
            onChange={setHotels}
            onSave={saveHotels}
            saving={savingHotels}
            catalogHotels={catalogHotels}
            onSendVoucher={sendHotelVoucher}
            sendingVoucher={sendingVoucher}
          />

          <BookingTransportEditor
            transport={transport}
            onChange={setTransport}
            onSave={saveTransport}
            saving={savingTransport}
            catalogCabs={catalogCabs}
          />

          {booking.activities?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-subtle bg-surface/80 p-6"
            >
              <h3 className="font-bold text-lg mb-4">Activities</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {booking.activities.map((a, i) => (
                  <div key={i} className="p-4 rounded-2xl border border-subtle bg-gradient-to-br from-rose-500/5 to-orange-500/5">
                    <p className="font-semibold">{a.name || a}</p>
                    <p className="text-xs text-content-muted mt-1 capitalize">{a.status || 'pending'}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-subtle bg-surface/80 p-6 space-y-4"
          >
            <h3 className="font-bold flex items-center gap-2 text-lg"><FileText className="w-5 h-5 text-indigo-600" /> Documents</h3>
            <form onSubmit={addDocument} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value }))} className="input-premium h-10 rounded-xl text-sm">
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <input value={docForm.fileName} onChange={(e) => setDocForm((f) => ({ ...f, fileName: e.target.value }))} placeholder="File name" className="input-premium h-10 rounded-xl text-sm" />
              <input value={docForm.fileUrl} onChange={(e) => setDocForm((f) => ({ ...f, fileUrl: e.target.value }))} placeholder="Document URL" required className="input-premium h-10 rounded-xl text-sm sm:col-span-2" />
              <Button type="submit" variant="teal" size="sm" className="rounded-xl h-10" disabled={addingDoc}>Add URL</Button>
            </form>
            <div className="space-y-2">
              {(booking.documents || []).map((d) => (
                <a key={d._id} href={d.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl border border-subtle hover:border-teal-500/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{d.fileName || d.type}</p>
                    <p className="text-xs text-content-muted capitalize">{d.type?.replace(/_/g, ' ')}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-teal-600" />
                </a>
              ))}
            </div>
          </motion.div>
        </div>

        <aside className="xl:col-span-4 space-y-4 xl:sticky xl:top-20">
          <div className="rounded-3xl border border-subtle bg-surface/90 p-5 shadow-sm">
            <h3 className="font-bold mb-4">Customer</h3>
            <p className="font-bold text-xl text-content-primary">{booking.customerName}</p>
            <div className="mt-3 space-y-2 text-sm text-content-secondary">
              <a href={booking.customerPhone ? `tel:${booking.customerPhone}` : undefined} className="flex items-center gap-2 hover:text-teal-600">
                <Phone className="w-4 h-4 text-teal-600" />{booking.customerPhone || '—'}
              </a>
              <a href={booking.customerEmail ? `mailto:${booking.customerEmail}` : undefined} className="flex items-center gap-2 hover:text-teal-600">
                <Mail className="w-4 h-4 text-teal-600" />{booking.customerEmail || '—'}
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-subtle bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Receipt className="w-4 h-4 text-emerald-600" /> Payment & Receipts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-content-muted">Advance</span><span className="font-bold">{formatINR(booking.advanceReceived)}</span></div>
              <div className="flex justify-between"><span className="text-content-muted">Pending</span><span className="font-bold text-amber-600">{formatINR(booking.pendingAmount)}</span></div>
              <div className="h-px bg-subtle my-2" />
              <div className="flex justify-between"><span className="font-medium">Total</span><span className="font-black text-lg">{formatINR(amount)}</span></div>
            </div>
            <div className="mt-4 space-y-2">
              {(booking.paymentLedger || []).map((payment, index) => (
                <button
                  key={payment._id || `${payment.paymentId}-${index}`}
                  type="button"
                  onClick={() => openReceipt(payment.receiptHtml)}
                  disabled={!payment.receiptHtml}
                  className="flex w-full items-center gap-2 rounded-xl border border-emerald-500/15 bg-white/50 p-2.5 text-left transition hover:border-emerald-500/30 disabled:cursor-default dark:bg-surface/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-content-primary">Payment {payment.installment} · {formatINR(payment.amount)}</p>
                    <p className="truncate text-[10px] text-content-muted">{formatDate(payment.receivedAt)} · {payment.method?.replace(/_/g, ' ') || 'Payment'}</p>
                  </div>
                  {payment.receiptHtml ? <ExternalLink className="h-3.5 w-3.5 text-emerald-600" /> : null}
                </button>
              ))}
              {!booking.paymentLedger?.length && (
                <p className="rounded-xl border border-dashed border-subtle p-3 text-center text-xs text-content-muted">No payment received yet</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-subtle bg-surface/90 p-5 space-y-2">
            <h3 className="font-bold mb-3">Quick Actions</h3>
            {booking.hotelConfirmation === 'pending' && (
              <Button variant="teal" className="w-full rounded-xl gap-2" disabled={actionLoading === 'hotel'} onClick={confirmHotel}>
                {actionLoading === 'hotel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hotel className="w-4 h-4" />}
                Confirm All Hotels
              </Button>
            )}
            {booking.cabConfirmation === 'pending' && (
              <Button variant="violet" className="w-full rounded-xl gap-2" disabled={actionLoading === 'cab'} onClick={confirmCab}>
                {actionLoading === 'cab' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
                Confirm Transport
              </Button>
            )}
            {booking.status === 'confirmed' && (
              <Button variant="emerald" className="w-full rounded-xl gap-2" disabled={actionLoading === 'in_progress'} onClick={() => updateStatus('in_progress')}>
                Mark In Progress
              </Button>
            )}
            {booking.status === 'in_progress' && (
              <Button variant="secondary" className="w-full rounded-xl gap-2" disabled={actionLoading === 'completed'} onClick={() => updateStatus('completed')}>
                Mark Completed
              </Button>
            )}
            <Link to="/operations-manager/vouchers">
              <Button variant="outline" className="w-full rounded-xl gap-2">
                <Ticket className="w-4 h-4" /> Generate Voucher
              </Button>
            </Link>
          </div>

          {(booking.tasks?.length > 0) && (
            <div className="rounded-3xl border border-subtle bg-surface/90 p-5 space-y-3">
              <h3 className="font-bold flex items-center gap-2"><ListTodo className="w-4 h-4" /> Tasks</h3>
              {booking.tasks.map((t) => (
                <div key={t._id} className="p-3 rounded-xl border border-subtle text-sm">
                  <p className="font-medium">{t.title}</p>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md capitalize', TASK_STATUS[t.status])}>{t.status?.replace(/_/g, ' ')}</span>
                    {t.status !== 'completed' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateTaskStatus(t._id, t.status === 'pending' ? 'in_progress' : 'completed')}>
                        {t.status === 'pending' ? 'Start' : 'Done'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
