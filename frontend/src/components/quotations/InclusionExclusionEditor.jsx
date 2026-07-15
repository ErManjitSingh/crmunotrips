import { useState } from 'react';
import { CheckCircle2, CircleOff, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

const TABS = [
  { key: 'inclusions', label: 'Inclusions', icon: CheckCircle2 },
  { key: 'exclusions', label: 'Exclusions', icon: CircleOff },
];

function normalizeLines(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => String(item || '').trim());
}

export function cleanInclusionExclusionLines(items = []) {
  return normalizeLines(items).filter(Boolean);
}

function LineEditor({ title, description, items, onChange, placeholder, accent }) {
  const lines = items.length ? items : [''];

  const updateLine = (index, value) => {
    const next = [...lines];
    next[index] = value;
    onChange(next);
  };

  const removeLine = (index) => {
    const next = lines.filter((_, i) => i !== index);
    onChange(next.length ? next : ['']);
  };

  const addLine = () => {
    onChange([...lines, '']);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-content-primary">{title}</h3>
        <p className="text-sm text-content-muted mt-1">{description}</p>
      </div>

      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {lines.map((line, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2">
            <span className={cn('mt-2.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', accent)}>
              {index + 1}
            </span>
            <input
              type="text"
              value={line}
              onChange={(e) => updateLine(index, e.target.value)}
              placeholder={placeholder}
              className="input-premium flex-1 h-10 rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={() => removeLine(index)}
              disabled={lines.length === 1 && !line.trim()}
              className="mt-1 p-2 rounded-lg text-content-muted hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Remove line"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={addLine}>
        <Plus className="w-4 h-4" />
        Add new line
      </Button>
    </div>
  );
}

export default function InclusionExclusionEditor({
  inclusions = [],
  exclusions = [],
  onChangeInclusions,
  onChangeExclusions,
  mode = 'both',
  initialTab = 'inclusions',
}) {
  const [tab, setTab] = useState(initialTab);
  const activeTab = mode === 'both' ? tab : mode;

  return (
    <div className="space-y-4">
      {mode === 'both' && (
        <div className="flex gap-1 p-1 rounded-2xl bg-white border border-emerald-100 shadow-sm">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const count = cleanInclusionExclusionLines(key === 'inclusions' ? inclusions : exclusions).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  active && key === 'inclusions' && 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25',
                  active && key === 'exclusions' && 'bg-rose-500 text-white shadow-md shadow-rose-500/25',
                  !active && 'text-slate-500 hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={cn(
          mode === 'both' && 'rounded-2xl border p-4 sm:p-5',
          mode === 'both' && activeTab === 'inclusions' && 'border-emerald-200 bg-emerald-50/50',
          mode === 'both' && activeTab === 'exclusions' && 'border-rose-200 bg-rose-50/50'
        )}
      >        {activeTab === 'inclusions' ? (
          <LineEditor
            title="Package Inclusions"
            description="What is included in this quotation — add or edit each point."
            items={inclusions}
            onChange={onChangeInclusions}
            placeholder="e.g. Breakfast & dinner at hotel"
            accent="bg-emerald-500/15 text-emerald-700"
          />
        ) : (
          <LineEditor
            title="Package Exclusions"
            description="What is not included — add or edit each point."
            items={exclusions}
            onChange={onChangeExclusions}
            placeholder="e.g. Personal expenses & tips"
            accent="bg-rose-500/15 text-rose-700"
          />
        )}
      </div>
    </div>
  );
}
