import { useMemo, useState } from 'react';
import { Car, ExternalLink, Eye, FileText, Loader2, Save, Send, Ticket } from 'lucide-react';
import PackageBuilderDayTimeline from '../../quotations/PackageBuilderDayTimeline';
import PackageResourcePickerDrawer from '../../quotations/PackageResourcePickerDrawer';
import { Button } from '../../ui/button';

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.label || value.name || value.title || value.value || value.key || '';
}

function hotelOption(hotel) {
  const nested = hotel?.hotel && typeof hotel.hotel === 'object' ? hotel.hotel : {};
  const source = { ...nested, ...hotel };
  const id = source._id || source.id || source.hotelId || source.uuid || source.name;
  const stars = Number(
    source.starRating ||
    source.starCategory ||
    String(source.category || '').match(/\d+/)?.[0] ||
    0
  );
  const image =
    source.image ||
    source.thumbnailUrl ||
    source.hotelImages?.[0] ||
    source.images?.[0] ||
    source.roomImage ||
    source.roomImages?.[0] ||
    source.room?.images?.[0] ||
    '';
  const images = [
    ...(source.images || []),
    ...(source.hotelImages || []),
    ...(source.roomImages || []),
    ...(source.room?.images || []),
  ].filter(Boolean);
  const roomList = source.roomTypes?.length
    ? source.roomTypes
    : source.rooms?.length
      ? source.rooms
      : source.room
        ? [source.room]
        : [];
  const rooms = roomList.length
    ? roomList.map((room, index) => ({
        id: room.id || room._id || `${id}-room-${index}`,
        name: room.name,
        baseRate: room.baseRate ?? room.pricePerNight ?? room.price ?? source.price ?? 0,
        maxOccupancy: room.maxOccupancy,
        images: room.images || images,
        mealPlanOptions: room.mealPlanOptions,
      }))
    : [{
        id: `${id}-room`,
        name: textValue(source.roomType) || textValue(source.tierName) || 'Standard Room',
        baseRate: source.price || source.priceDelta || 0,
        images,
      }];
  return {
    id,
    hotelId: id,
    name: source.name || source.hotelName,
    image,
    images,
    location: source.location || source.destination || source.city || '',
    city: source.city || source.destination || source.location || '',
    slug: source.slug || '',
    starRating: stars,
    tierName: rooms[0]?.name,
    meals: textValue(source.mealPlan) || source.meals || '',
    priceDelta: source.perNight || source.priceDelta || source.price || rooms[0]?.baseRate || 0,
    startingPrice: source.startingPrice || source.price || rooms[0]?.baseRate || 0,
    rooms,
    contactPerson: source.contactPerson || source.contact?.name || '',
    phone: source.phone || source.contact?.phone || '',
    email: source.email || source.contact?.email || '',
    address: source.address || source.location || '',
  };
}

function cabOption(cab) {
  return {
    id: cab._id,
    packageCabId: cab._id,
    name: textValue(cab.vehicleType) || 'Private Cab',
    seatingCapacity: cab.capacity || cab.seatingCapacity,
    pickupLocation: cab.pickupLocation || '',
    dropLocation: cab.dropLocation || '',
    driverName: cab.driverName || '',
    driverPhone: cab.driverPhone || '',
    vehicleNumber: cab.vehicleNumber || '',
    priceDelta: cab.price || cab.cost || 0,
  };
}

function hotelMeta(day, catalogById) {
  const selected =
    catalogById.get(String(day.dayHotel?.hotelId || '')) ||
    catalogById.get(`name:${String(day.dayHotel?.hotelName || '').toLowerCase()}`);
  return {
    name: day.dayHotel?.hotelName || selected?.name || day.accommodation || '',
    image: selected?.image,
    images: selected?.images,
    starRating: selected?.starRating,
    meals: day.dayHotel?.mealPlan || selected?.meals || day.meals || '',
    tierName: day.dayHotel?.roomType || selected?.tierName || '',
    location: day.dayHotel?.location || selected?.location || '',
    priceDelta: selected?.priceDelta || 0,
  };
}

function stripTimelineUi(day) {
  const clean = { ...day };
  delete clean.hotelMeta;
  delete clean.hotelOptions;
  delete clean.hotel;
  return clean;
}

export default function OperationsItineraryBuilder({
  itinerary = [],
  onChange,
  onSave,
  saving,
  onPdf,
  generatingPdf,
  pdfUrl,
  catalogHotels = [],
  quotationHotels = [],
  catalogCabs = [],
  hotels = [],
  vouchers = [],
  onHotelsChange,
  onSendHotelVoucher,
  sendingHotelVoucher,
  destination,
}) {
  const [picker, setPicker] = useState(null);
  const hotelOptions = useMemo(() => {
    const merged = [...quotationHotels, ...catalogHotels].map(hotelOption).filter((hotel) => hotel.name);
    const seen = new Set();
    return merged.filter((hotel) => {
      const key = String(hotel.name).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [catalogHotels, quotationHotels]);
  const cabOptions = useMemo(() => catalogCabs.map(cabOption), [catalogCabs]);
  const hotelsById = useMemo(
    () => new Map(hotelOptions.flatMap((hotel) => [
      [String(hotel.id), hotel],
      [`name:${String(hotel.name).toLowerCase()}`, hotel],
    ])),
    [hotelOptions]
  );

  const timelineDays = itinerary.map((day, index) => ({
    ...day,
    id: day.id || `ops-day-${day.day || index + 1}`,
    hotel: day.dayHotel?.hotelName || day.accommodation || '',
    hotelMeta: hotelMeta(day, hotelsById),
    hotelOptions,
  }));

  const packageCabDay = timelineDays.find((day) => day.dayCab);
  const packageCab = packageCabDay?.dayCab
    ? {
        id: packageCabDay.dayCab.cabId || packageCabDay.dayCab.vehicleType,
        name: textValue(packageCabDay.dayCab.vehicleType) || 'Private Cab',
        seatingCapacity: packageCabDay.dayCab.seatingCapacity,
      }
    : null;
  const emitChange = (days) => onChange(days.map(stripTimelineUi));

  const hotelForDay = (day) => {
    const name = String(day.dayHotel?.hotelName || day.hotel || '').trim().toLowerCase();
    if (!name) return null;
    const dayNumber = Number(day.day);
    return hotels.find((hotel) => {
      if (String(hotel.hotelName || '').trim().toLowerCase() !== name) return false;
      if (!hotel.day) return true;
      const start = Number(hotel.day);
      const end = start + Math.max(1, Number(hotel.nights) || 1) - 1;
      return dayNumber >= start && dayNumber <= end;
    }) || hotels.find((hotel) => String(hotel.hotelName || '').trim().toLowerCase() === name);
  };

  const updateGroupedHotelEmail = (assignment, email) => {
    const name = String(assignment.hotelName || '').trim().toLowerCase();
    onHotelsChange?.(hotels.map((hotel) => (
      String(hotel.hotelName || '').trim().toLowerCase() === name
        ? { ...hotel, email }
        : hotel
    )));
  };

  const renderHotelVoucherActions = (day) => {
    const assignment = hotelForDay(day);
    if (!day.dayHotel?.hotelName && !day.hotel) return null;
    const voucher = assignment?.voucherId
      ? vouchers.find((item) => String(item._id) === String(assignment.voucherId))
      : null;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Ticket className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-800">Day {day.day} hotel voucher</p>
              <p className="text-[10px] text-slate-500">
                {assignment?.voucherSentAt ? 'Sent · same hotel days grouped' : 'Same hotel days will use one voucher'}
              </p>
            </div>
          </div>
          <input
            type="email"
            value={assignment?.email || ''}
            onChange={(event) => assignment && updateGroupedHotelEmail(assignment, event.target.value)}
            placeholder={assignment ? 'Hotel email' : 'Save itinerary first'}
            disabled={!assignment}
            className="h-9 min-w-0 rounded-lg border border-amber-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-amber-400 sm:w-52"
          />
          <div className="flex gap-2">
            {voucher?.pdfUrl ? (
              <a
                href={voucher.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-[11px] font-bold text-amber-700"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Voucher will be available after it is sent"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-[11px] font-bold text-amber-400 opacity-60"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
            )}
            <button
              type="button"
              onClick={() => assignment && onSendHotelVoucher?.(assignment)}
              disabled={!assignment?._id || !assignment?.email || sendingHotelVoucher === assignment?._id}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-[11px] font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingHotelVoucher === assignment?._id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
              {assignment?.voucherSentAt ? 'Resend' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const selectHotel = (option) => {
    if (!picker?.day) return;
    const roomType = textValue(option.room) || option.tierName || '';
    const mealPlan = textValue(option.mealPlan) || option.meals || '';
    emitChange(timelineDays.map((day) => {
      if (day.id !== picker.day.id) return day;
      return {
        ...day,
        accommodation: [option.name, roomType, mealPlan].filter(Boolean).join(' · '),
        meals: mealPlan || day.meals,
        dayHotel: {
          hotelId: option.hotelId || option.id,
          hotelName: option.name,
          destination: option.city || option.location || destination || '',
          location: option.location || '',
          roomType,
          mealPlan,
          source: 'catalog',
        },
        hotelMeta: {
          name: option.name,
          image: option.image,
          images: option.images,
          starRating: option.starRating,
          meals: mealPlan,
          tierName: roomType,
          location: option.location,
          priceDelta: option.perNight || option.priceDelta || 0,
        },
      };
    }));
    setPicker(null);
  };

  const selectCab = (option) => {
    const targetId = packageCabDay?.id || timelineDays[0]?.id;
    emitChange(timelineDays.map((day) => (
      day.id === targetId
        ? {
            ...day,
            transport: [option.name, option.pickupLocation && option.dropLocation
              ? `${option.pickupLocation} → ${option.dropLocation}`
              : ''].filter(Boolean).join(' · '),
            dayCab: {
              cabId: option.id,
              vehicleType: textValue(option.name).toLowerCase().replace(/\s+/g, '_'),
              pickupLocation: option.pickupLocation || '',
              dropLocation: option.dropLocation || '',
              driverName: option.driverName || '',
              driverPhone: option.driverPhone || '',
              vehicleNumber: option.vehicleNumber || '',
              source: 'catalog',
            },
          }
        : day
    )));
    setPicker(null);
  };

  return (
    <div className="rounded-3xl border border-subtle bg-white/90 p-4 shadow-xl shadow-black/5 sm:p-6 dark:bg-slate-900/90">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-600">Customer itinerary</p>
          <h2 className="mt-1 text-lg font-black text-content-primary">Day-wise Itinerary</h2>
          <p className="mt-1 text-xs text-content-muted">Same executive view · change hotel, room, meal plan or cab from the popup</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setPicker({ type: 'cab' })}>
            <Car className="h-3.5 w-3.5" /> Change Cab
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" disabled={generatingPdf} onClick={onPdf}>
            {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Itinerary
          </Button>
          <Button variant="teal" size="sm" className="rounded-xl gap-1.5" disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      </div>

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Open generated itinerary
        </a>
      )}

      <PackageBuilderDayTimeline
        itinerary={timelineDays}
        dayWiseHotels={[]}
        packageCab={packageCab}
        onChange={emitChange}
        onOpenHotelPicker={(day) => setPicker({ type: 'hotel', day })}
        onChangeCab={() => setPicker({ type: 'cab' })}
        renderHotelActions={renderHotelVoucherActions}
        destination={destination || 'Destination'}
        embedded
      />

      <PackageResourcePickerDrawer
        open={picker?.type === 'hotel'}
        onClose={() => setPicker(null)}
        mode="hotel"
        title={picker?.day ? `Change hotel · Day ${picker.day.day}` : 'Change hotel'}
        subtitle="Hotel → Room → Meal plan, exactly as in the sales quotation"
        options={hotelOptions}
        selectedId={picker?.day?.dayHotel?.hotelId}
        onSelect={selectHotel}
        nights={1}
        destination={destination}
      />

      <PackageResourcePickerDrawer
        open={picker?.type === 'cab'}
        onClose={() => setPicker(null)}
        mode="cab"
        title="Change cab"
        subtitle="Choose the vehicle for this itinerary"
        options={cabOptions}
        selectedId={packageCab?.id}
        onSelect={selectCab}
      />
    </div>
  );
}
