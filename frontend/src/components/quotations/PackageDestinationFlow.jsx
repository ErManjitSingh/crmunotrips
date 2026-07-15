import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPin, GripVertical, Plus, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

function SortableStop({ id, label, index, total, onRemove, canRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const hint = isFirst ? 'Pickup' : isLast ? 'Drop' : '';

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 shrink-0">
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm',
          isFirst && 'bg-emerald-50 border-emerald-300',
          isLast && !isFirst && 'bg-rose-50 border-rose-300',
          !isFirst && !isLast && 'bg-amber-50 border-amber-300',
          isDragging && 'ring-2 ring-amber-400 border-amber-400'
        )}
      >
        <button type="button" className="cursor-grab text-amber-400 hover:text-amber-600" {...attributes} {...listeners}>
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <span
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
            isFirst && 'bg-emerald-500 text-white',
            isLast && !isFirst && 'bg-rose-500 text-white',
            !isFirst && !isLast && 'bg-amber-500 text-white'
          )}
        >
          <MapPin className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate max-w-[120px]">{label}</p>
          {hint && (
            <p
              className={cn(
                'text-[10px] font-bold uppercase tracking-wide',
                isFirst && 'text-emerald-600',
                isLast && !isFirst && 'text-rose-600'
              )}
            >
              {hint}
            </p>
          )}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] font-bold text-slate-300 hover:text-rose-500 px-1"
            title="Remove"
          >
            ×
          </button>
        )}
      </div>
      {!isLast && <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />}
    </div>
  );
}

export default function PackageDestinationFlow({ destinations = [], onChange, embedded = false }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const items = destinations.map((d, i) => ({
    id: d.id || `dest-${i}-${d.name}`,
    name: d.name || d,
  }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((d) => d.id === active.id);
    const newIndex = items.findIndex((d) => d.id === over.id);
    onChange?.(arrayMove(items, oldIndex, newIndex));
  };

  const addStop = () => {
    const name = window.prompt('Add destination stop');
    if (!name?.trim()) return;
    onChange?.([...items, { id: `dest-${Date.now()}`, name: name.trim() }]);
  };

  const body = (
    <>
      <div className={cn('flex items-center justify-between gap-3', embedded ? 'mb-3' : 'mb-4')}>
        {!embedded && (
          <div>
            <h3 className="text-base font-bold text-slate-900">Destination Flow</h3>
            <p className="text-xs text-slate-500">Drag to reorder route stops</p>
          </div>
        )}
        <div className={cn('flex items-center gap-2', embedded && 'ml-auto')}>
          <span className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Reorder
          </span>
          <button
            type="button"
            onClick={addStop}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-400 shadow-sm shadow-amber-300/40"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 rounded-xl border border-amber-100 bg-white/70 p-3">
            {items.map((d, i) => (
              <SortableStop
                key={d.id}
                id={d.id}
                label={d.name}
                index={i}
                total={items.length}
                canRemove={items.length > 2}
                onRemove={() => onChange?.(items.filter((x) => x.id !== d.id))}
              />
            ))}
            {!items.length && (
              <p className="text-sm text-amber-700/70 py-2">No destinations yet — click Add</p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 sm:p-5 shadow-sm">
      {body}
    </div>
  );
}
