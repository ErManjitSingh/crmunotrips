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
  MapPin,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { defaultItineraryDay } from './quotationUtils';

function Chip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600">
      <Icon className="w-3 h-3 text-violet-500" />
      {children}
    </span>
  );
}

function SortableDayCard({ day, hotelSel, onChange, onRemove, onDuplicate, canRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };

  const update = (field, value) => onChange({ ...day, [field]: value });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]',
        'hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition-shadow',
        isDragging && 'ring-2 ring-violet-300'
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <button
          type="button"
          className="mt-1 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-grab"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-bold shadow-sm shadow-orange-500/25">
              Day {day.day}
            </span>
            <input
              value={day.title || ''}
              onChange={(e) => update('title', e.target.value)}
              placeholder="Day title"
              className="flex-1 min-w-[180px] h-9 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <button type="button" onClick={onDuplicate} className="p-1.5 rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600" title="Duplicate day">
              <Copy className="w-4 h-4" />
            </button>
            {canRemove && (
              <button type="button" onClick={onRemove} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete day">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip icon={Car}>{day.transport || 'Private Transfer'}</Chip>
            <Chip icon={UtensilsCrossed}>{day.meals || 'Meals'}</Chip>
            <Chip icon={MapPin}>{day.hotel || hotelSel?.hotel?.name || 'Stay'}</Chip>
          </div>
        </div>
      </div>

      {(hotelSel?.hotel || day.hotel) && (
        <div className="mb-3 flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
            {hotelSel?.hotel?.image || hotelSel?.hotel?.images?.[0] ? (
              <img
                src={hotelSel.hotel.image || hotelSel.hotel.images[0]}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Hotel className="w-6 h-6 text-violet-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {hotelSel?.hotel?.name || day.hotel}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {[hotelSel?.roomType?.name, hotelSel?.mealPlan?.label || day.meals]
                .filter(Boolean)
                .join(' · ') || 'Hotel stay included'}
            </p>
            {hotelSel?.hotel?.starRating ? (
              <p className="text-[11px] text-amber-600 font-semibold mt-1">
                {'★'.repeat(Math.min(5, Number(hotelSel.hotel.starRating) || 0))}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <textarea
        value={day.description || ''}
        onChange={(e) => update('description', e.target.value)}
        placeholder="Describe experiences, sightseeing and transfers for this day..."
        rows={3}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20 mb-3"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { key: 'hotel', label: 'Hotel / Stay', icon: Hotel },
          { key: 'transport', label: 'Transfer', icon: Car },
          { key: 'meals', label: 'Meals', icon: UtensilsCrossed },
          { key: 'activities', label: 'Activities', icon: Sparkles },
        ].map(({ key, label, icon: Icon }) => (
          <label key={key} className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 inline-flex items-center gap-1 mb-1">
              <Icon className="w-3 h-3" /> {label}
            </span>
            <input
              value={day[key] || ''}
              onChange={(e) => update(key, e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function PackageBuilderDayTimeline({
  itinerary = [],
  dayWiseHotels = [],
  onChange,
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
          <p className="text-xs text-slate-500">Drag to reorder · edit hotels, meals, transfers & experiences</p>
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
                  onChange={(d) => updateDay(idx, d)}
                  onRemove={() => removeDay(idx)}
                  onDuplicate={() => duplicateDay(idx)}
                  canRemove={itinerary.length > 1}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!itinerary.length && (
        <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">No days yet</p>
          <p className="text-xs text-slate-500 mt-1">Select a package or add a day to start building.</p>
        </div>
      )}
    </div>
  );
}
