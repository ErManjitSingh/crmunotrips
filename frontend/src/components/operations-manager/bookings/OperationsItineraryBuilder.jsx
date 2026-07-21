import { useMemo, useState } from 'react';
import { Car, ExternalLink, FileText, Loader2, Save } from 'lucide-react';
import PackageBuilderDayTimeline from '../../quotations/PackageBuilderDayTimeline';
import PackageResourcePickerDrawer from '../../quotations/PackageResourcePickerDrawer';
import { Button } from '../../ui/button';

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.label || value.name || value.title || value.value || value.key || '';
}

function hotelOption(hotel) {
  const stars = Number(String(hotel.category || '').match(/\d+/)?.[0] || 0);
  const rooms = hotel.roomTypes?.length
    ? hotel.roomTypes.map((room, index) => ({
        id: `${hotel._id}-room-${index}`,
        name: room.name,
        baseRate: room.baseRate,
        maxOccupancy: room.maxOccupancy,
      }))
    : [{
        id: `${hotel._id}-room`,
        name: hotel.roomType || 'Standard Room',
        baseRate: hotel.price || 0,
      }];
  return {
    id: hotel._id,
    hotelId: hotel._id,
    name: hotel.name,
    location: hotel.location || hotel.destination || '',
    city: hotel.destination || hotel.location || '',
    starRating: stars,
    tierName: rooms[0]?.name,
    meals: hotel.mealPlan || '',
    priceDelta: hotel.price || rooms[0]?.baseRate || 0,
    startingPrice: hotel.price || rooms[0]?.baseRate || 0,
    rooms,
    contactPerson: hotel.contactPerson || '',
    phone: hotel.phone || '',
    email: hotel.email || '',
    address: hotel.address || hotel.location || '',
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
  const selected = catalogById.get(String(day.dayHotel?.hotelId || ''));
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
  catalogCabs = [],
  destination,
}) {
  const [picker, setPicker] = useState(null);
  const hotelOptions = useMemo(() => catalogHotels.map(hotelOption), [catalogHotels]);
  const cabOptions = useMemo(() => catalogCabs.map(cabOption), [catalogCabs]);
  const hotelsById = useMemo(
    () => new Map(hotelOptions.map((hotel) => [String(hotel.id), hotel])),
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
