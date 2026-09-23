/**
 * The one semantic colour system for Executive Lead Status — every header, number, badge, card,
 * bar segment and selected state reads from here so a colour always means the same bucket.
 * (Full class strings on purpose: Tailwind only generates classes it can see verbatim.)
 *
 *   Assigned → violet   Cold → blue   Warm → amber   Hot → rose   Unclassified → slate
 */
export const STATUS_THEME = {
  assigned: {
    key: 'assigned',
    label: 'Assigned',
    dot: 'bg-violet-500',
    text: 'text-violet-700',
    strong: 'text-violet-900',
    headerTint: 'bg-violet-50/70',
    card: 'border-violet-100 bg-gradient-to-br from-violet-50 to-white',
    cardActive: 'border-violet-300 ring-2 ring-violet-400/40',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200',
    bar: 'bg-violet-500',
  },
  cold: {
    key: 'cold',
    label: 'Cold',
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    strong: 'text-blue-900',
    headerTint: 'bg-blue-50/70',
    card: 'border-blue-100 bg-gradient-to-br from-blue-50 to-white',
    cardActive: 'border-blue-300 ring-2 ring-blue-400/40',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    bar: 'bg-blue-500',
  },
  warm: {
    key: 'warm',
    label: 'Warm',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    strong: 'text-amber-900',
    headerTint: 'bg-amber-50/70',
    card: 'border-amber-100 bg-gradient-to-br from-amber-50 to-white',
    cardActive: 'border-amber-300 ring-2 ring-amber-400/40',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    bar: 'bg-amber-500',
  },
  hot: {
    key: 'hot',
    label: 'Hot',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    strong: 'text-rose-900',
    headerTint: 'bg-rose-50/70',
    card: 'border-rose-100 bg-gradient-to-br from-rose-50 to-white',
    cardActive: 'border-rose-300 ring-2 ring-rose-400/40',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    bar: 'bg-rose-500',
  },
  // Terminal states, used by the Cold Calling analytics only (not part of STATUS_ORDER / the Sales report).
  converted: {
    key: 'converted',
    label: 'Converted',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    strong: 'text-emerald-900',
    headerTint: 'bg-emerald-50/70',
    card: 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white',
    cardActive: 'border-emerald-300 ring-2 ring-emerald-400/40',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    bar: 'bg-emerald-500',
  },
  lost: {
    key: 'lost',
    label: 'Lost / Closed',
    dot: 'bg-stone-500',
    text: 'text-stone-700',
    strong: 'text-stone-900',
    headerTint: 'bg-stone-100/70',
    card: 'border-stone-200 bg-gradient-to-br from-stone-100 to-white',
    cardActive: 'border-stone-400 ring-2 ring-stone-400/40',
    badge: 'bg-stone-100 text-stone-700 ring-stone-300',
    bar: 'bg-stone-400',
  },
  unclassified: {
    key: 'unclassified',
    label: 'Unclassified',
    dot: 'bg-slate-400',
    text: 'text-slate-600',
    strong: 'text-slate-800',
    headerTint: 'bg-slate-100/70',
    card: 'border-slate-200 bg-gradient-to-br from-slate-100 to-white',
    cardActive: 'border-slate-400 ring-2 ring-slate-400/40',
    badge: 'bg-slate-100 text-slate-600 ring-slate-300',
    bar: 'bg-slate-300',
  },
};

/** Column / card order: the report's contract (Assigned, Cold, Warm, Hot, Unclassified). */
export const STATUS_ORDER = ['assigned', 'cold', 'warm', 'hot', 'unclassified'];
export const STATUS_COLUMNS = STATUS_ORDER.map((key) => STATUS_THEME[key]);
