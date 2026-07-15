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
import { MapPin, GripVertical, Plus, X } from 'lucide-react';
import { cn } from '../../lib/utils';

function SortableChip({ id, label, onRemove, canRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 shadow-sm',
        isDragging && 'ring-2 ring-violet-300'
      )}
    >
      <button type="button" className="cursor-grab text-violet-400" {...attributes} {...listeners}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <MapPin className="w-3.5 h-3.5" />
      <span>{label}</span>
      {canRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 text-violet-400 hover:text-rose-500">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function PackageDestinationFlow({ destinations = [], onChange }) {
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

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Destination Flow</p>
          <p className="text-xs text-slate-500">Drag to reorder route stops</p>
        </div>
        <button
          type="button"
          onClick={addStop}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:border-violet-300 hover:text-violet-600"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap items-center gap-2">
            {items.map((item, idx) => (
              <div key={item.id} className="inline-flex items-center gap-2">
                <SortableChip
                  id={item.id}
                  label={item.name}
                  canRemove={items.length > 1}
                  onRemove={() => onChange?.(items.filter((d) => d.id !== item.id))}
                />
                {idx < items.length - 1 && (
                  <span className="text-slate-300 text-sm font-bold">→</span>
                )}
              </div>
            ))}
            {!items.length && (
              <p className="text-xs text-slate-400">No destinations yet — add a stop to begin.</p>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
