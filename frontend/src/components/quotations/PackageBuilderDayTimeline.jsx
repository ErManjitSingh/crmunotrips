import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Car,
  Hotel,
  UtensilsCrossed,
  Sparkles,
  Star,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { defaultItineraryDay, formatINR } from './quotationUtils';

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      {children}
    </span>
  );
}

function ChangeBtn({ onClick, label = 'Change' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-emerald-300 bg-white text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 shrink-0"
    >
      <RefreshCw className="w-3 h-3" />
      {label}
    </button>
  );
}

function HotelCard({ meta, options = [], onReplace, emptyLabel }) {
  const [picking, setPicking] = useState(false);
  const image = meta?.image || meta?.images?.[0];
  const stars = Math.min(5, Math.round(Number(meta?.starRating || 0)));
  const hasOptions = options.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="w-16 h-16 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 overflow-hidden">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Hotel className="w-6 h-6 text-violet-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Hotel & Stay</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{meta?.name || emptyLabel}</p>
            </div>
            {hasOptions && (
              <ChangeBtn onClick={() => setPicking((v) => !v)} label={picking ? 'Close' : 'Change'} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
            {stars > 0 && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {stars}★
              </span>
            )}
            {meta?.tierName && <span>{meta.tierName}</span>}
            {meta?.meals && <span>· {meta.meals}</span>}
          </div>
        </div>
      </div>

      {picking && hasOptions && (
        <div className="px-3 pb-3 border-t border-slate-200/80 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
          {options.map((opt) => {
            const active = (opt.id || opt.name) === (meta?.id || meta?.name);
            return (
              <button
                key={opt.id || opt.name}
                type="button"
                onClick={() => {
                  onReplace?.(opt);
                  setPicking(false);
                }}
                className={cn(
                  'text-left text-[11px] font-semibold px-2.5 py-2 rounded-lg border bg-white',
                  active ? 'border-violet-400 text-violet-700' : 'border-slate-200 text-slate-700 hover:border-violet-300'
                )}
              >
                <span className="block truncate">{opt.name}</span>
                {Number(opt.priceDelta) > 0 && (
                  <span className="text-[10px] text-emerald-600">+{formatINR(opt.priceDelta)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CabCard({ packageCab, onChangeCab }) {
  if (!packageCab) return null;
  return (
    <div className="flex gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
      <div className="w-16 h-16 rounded-xl bg-white border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
        {packageCab.featuredImage ? (
          <img src={packageCab.featuredImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <Car className="w-6 h-6 text-emerald-600" />
        )}
      </div>
      <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Cab Included</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{packageCab.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {[packageCab.seatingCapacity ? `${packageCab.seatingCapacity} seats` : null, 'AC Vehicle']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {onChangeCab && <ChangeBtn onClick={onChangeCab} />}
      </div>
    </div>
  );
}

function SortableDayCard({
  day,
  hotelSel,
  packageCab,
  onChange,
  onRemove,
  onDuplicate,
  onReplaceHotel,
  onChangeCab,
  canRemove,
  isLastDay,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };

  const update = (field, value) => onChange({ ...day, [field]: value });

  const hotelMeta =
    day.hotelMeta ||
    (hotelSel?.hotel
      ? {
          name: hotelSel.hotel.name,
          image: hotelSel.hotel.image || hotelSel.hotel.images?.[0],
          images: hotelSel.hotel.images,
          starRating: hotelSel.hotel.starRating || hotelSel.hotel.starCategory,
          meals: hotelSel.mealPlan?.label || day.meals,
          tierName: hotelSel.room?.name,
          location: hotelSel.hotel.location,
          priceDelta: hotelSel.perNight,
        }
      : day.hotel
        ? { name: day.hotel, meals: day.meals }
        : null);

  const hotelOptions = day.hotelOptions || hotelSel?.hotelOptions || [];

  const facts = [
    { icon: Car, label: 'Travel & Transfer', value: packageCab?.name || day.transport || 'Private Transfer' },
    { icon: Hotel, label: 'Hotel & Stay', value: hotelMeta?.name || day.hotel || (isLastDay ? 'Departure' : '—') },
    { icon: Sparkles, label: 'Activities', value: day.activities || day.sightseeing || 'Sightseeing' },
    { icon: UtensilsCrossed, label: 'Meals', value: hotelMeta?.meals || day.meals || 'As per plan' },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm',
        isDragging && 'ring-2 ring-violet-300'
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <button
          type="button"
          className="mt-1 p-1 rounded-lg text-slate-300 hover:bg-slate-100 cursor-grab"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center justify-center min-w-[58px] h-7 px-2.5 rounded-full bg-violet-600 text-white text-[11px] font-bold shadow-sm shadow-violet-600/25">
              Day {day.day}
            </span>
            <input
              value={day.title || ''}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Day title"
              className="flex-1 min-w-[160px] h-9 rounded-lg border border-transparent hover:border-slate-200 focus:border-violet-300 px-2 text-sm font-bold text-slate-900 focus:outline-none bg-transparent"
            />
            <button type="button" onClick={onDuplicate} className="p-1.5 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600">
              <Copy className="w-4 h-4" />
            </button>
            {canRemove && (
              <button type="button" onClick={onRemove} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip>Transport</Chip>
            <Chip>Stay</Chip>
            <Chip>Meals</Chip>
            {day.sightseeing && <Chip>Sightseeing</Chip>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2">
            <p className="text-[10px] font-semibold text-slate-400 inline-flex items-center gap-1 mb-1">
              <Icon className="w-3 h-3 text-violet-500" />
              {label}
            </p>
            <p className="text-xs font-semibold text-slate-800 line-clamp-2">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-3">
        <HotelCard
          meta={hotelMeta}
          options={hotelOptions}
          onReplace={(opt) => onReplaceHotel?.(day, opt)}
          emptyLabel={isLastDay ? 'Departure day · no overnight stay' : 'Hotel not linked'}
        />
        {packageCab && day.day === 1 && <CabCard packageCab={packageCab} onChangeCab={onChangeCab} />}
      </div>

      <textarea
        value={day.description || ''}
        onChange={(e) => update('description', e.target.value)}
        placeholder="Describe experiences, sightseeing and transfers for this day..."
        rows={3}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20"
      />
    </div>
  );
}

export default function PackageBuilderDayTimeline({
  itinerary = [],
  dayWiseHotels = [],
  packageCab = null,
  onChange,
  onReplaceHotel,
  onChangeCab,
  destination = 'Destination',
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itinerary.findIndex((d) => d.id === active.id);
    const newIndex = itinerary.findIndex((d) => d.id === over.id);
    onChange?.(arrayMove(itinerary, oldIndex, newIndex).map((d, i) => ({ ...d, day: i + 1 })));
  };

  const addDay = () => {
    onChange?.([...itinerary, defaultItineraryDay(itinerary.length + 1, destination)]);
  };

  const updateDay = (idx, day) => {
    const next = [...itinerary];
    next[idx] = day;
    onChange?.(next);
  };

  const removeDay = (idx) => {
    onChange?.(itinerary.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 })));
  };

  const duplicateDay = (idx) => {
    const copy = {
      ...JSON.parse(JSON.stringify(itinerary[idx])),
      id: `day-${Date.now()}-${idx}`,
      day: itinerary.length + 1,
      title: `${itinerary[idx].title || `Day ${idx + 1}`} (copy)`,
    };
    onChange?.([...itinerary, copy].map((d, i) => ({ ...d, day: i + 1 })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Day-wise Itinerary</h3>
          <p className="text-xs text-slate-500">Hotels & cab from package API · drag to reorder</p>
        </div>
        <button
          type="button"
          onClick={addDay}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-violet-600 text-white text-xs font-semibold shadow-sm shadow-violet-600/25"
        >
          <Plus className="w-3.5 h-3.5" /> Add Day
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itinerary.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {itinerary.map((day, idx) => {
              const hotelSel = dayWiseHotels.find((h) => h.day === (day.day || idx + 1));
              return (
                <SortableDayCard
                  key={day.id}
                  day={day}
                  hotelSel={hotelSel}
                  packageCab={packageCab}
                  onChange={(d) => updateDay(idx, d)}
                  onRemove={() => removeDay(idx)}
                  onDuplicate={() => duplicateDay(idx)}
                  onReplaceHotel={onReplaceHotel}
                  onChangeCab={onChangeCab}
                  canRemove={itinerary.length > 1}
                  isLastDay={idx === itinerary.length - 1}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!itinerary.length && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">No days yet</p>
          <p className="text-xs text-slate-500 mt-1">Select a package or add a day to start building.</p>
        </div>
      )}
    </div>
  );
}
