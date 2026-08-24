import DashboardPanel from './DashboardPanel';

const STAGES = [
  { key: 'leads', label: 'Leads', color: '#7C3AED' },
  { key: 'warm', label: 'Warm', color: '#F59E0B' },
  { key: 'hot', label: 'Hot', color: '#E11D48' },
  { key: 'cold', label: 'Cold', color: '#64748B' },
  { key: 'bookings', label: 'Bookings', color: '#3B82F6' },
];

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 10000) / 100;
}

/**
 * True inverted trapezoid funnel — same visual language as the UNO admin mock.
 * Each band is a trapezoid polygon (top wider than bottom).
 */
export default function AdminSalesFunnel({ data = [] }) {
  const byLabel = Object.fromEntries(
    (data || []).map((s) => [String(s.stage || '').toLowerCase(), Number(s.count || 0)])
  );

  const counts = STAGES.map((s, i) => {
    const fromData = data[i]?.count;
    const byName =
      byLabel[s.label.toLowerCase()] ??
      byLabel[s.key] ??
      (s.key === 'leads' ? byLabel.lead : undefined);
    return Number(fromData ?? byName ?? 0);
  });

  const [leads, warm, hot, cold, bookings] = counts;
  const conversions = [
    { label: 'Overall Conversion', value: pct(bookings, leads) },
    { label: 'Lead → Warm', value: pct(warm, leads) },
    { label: 'Lead → Hot', value: pct(hot, leads) },
    { label: 'Lead → Cold', value: pct(cold, leads) },
  ];

  // Trapezoid geometry in viewBox 0..100 x 0..100
  const bandH = 18;
  const gap = 2.2;
  const topW = [100, 84, 68, 52, 36];
  const bands = STAGES.map((stage, i) => {
    const y = i * (bandH + gap);
    const wTop = topW[i];
    const wBot = topW[i + 1] ?? topW[i] * 0.55;
    const xTop = (100 - wTop) / 2;
    const xBot = (100 - wBot) / 2;
    const points = [
      `${xTop},${y}`,
      `${xTop + wTop},${y}`,
      `${xBot + wBot},${y + bandH}`,
      `${xBot},${y + bandH}`,
    ].join(' ');
    return { ...stage, count: counts[i], points, y, midY: y + bandH / 2 };
  });

  return (
    <DashboardPanel title="Sales Funnel" className="h-full">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto w-full max-w-[280px] shrink-0 sm:mx-0">
          <svg viewBox="0 0 100 100" className="h-auto w-full drop-shadow-sm" aria-hidden>
            {bands.map((band) => (
              <g key={band.key}>
                <polygon points={band.points} fill={band.color} />
                <text
                  x="50"
                  y={band.midY + 1.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  style={{ fontSize: '4.2px', fontWeight: 700 }}
                >
                  {band.count.toLocaleString('en-IN')} {band.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {conversions.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <p className="text-[12px] font-medium text-slate-500">{c.label}</p>
              <p className="text-[15px] font-bold tabular-nums text-slate-800">
                {c.value.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
