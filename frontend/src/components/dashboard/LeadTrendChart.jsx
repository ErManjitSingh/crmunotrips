import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown } from 'lucide-react';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-slate-800">{label}</p>
      <p className="text-violet-600">
        Generated: {Number(row.leadsGenerated || 0).toLocaleString('en-IN')}
      </p>
      <p className="text-emerald-600">
        Connected: {Number(row.connectedLeads || 0).toLocaleString('en-IN')}
      </p>
      <p className="text-orange-500">
        Qualified: {Number(row.qualifiedLeads || 0).toLocaleString('en-IN')}
      </p>
      <p className="text-pink-500">
        Quotations: {Number(row.quotationLeads || 0).toLocaleString('en-IN')}
      </p>
      <p className="text-blue-600">
        Bookings: {Number(row.convertedLeads || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

const RANGES = [
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '14d', label: 'Last 14 Days', days: 14 },
  { key: '7d', label: 'Last 7 Days', days: 7 },
];

export default function LeadTrendChart({ stats }) {
  const [rangeKey, setRangeKey] = useState('30d');
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];

  const daily = stats?.report?.dailyLeadTrend || [];
  const monthly = stats?.report?.monthlyLeadTrend || [];

  const rows = useMemo(() => {
    if (Array.isArray(daily) && daily.length) {
      return daily.slice(-range.days);
    }
    return Array.isArray(monthly) ? monthly : [];
  }, [daily, monthly, range.days]);

  const totals = useMemo(() => {
    const funnel = stats?.report?.salesFunnel || stats?.salesFunnel || [];
    const fromFunnel = Object.fromEntries(
      funnel.map((s) => [String(s.stage || '').toLowerCase(), Number(s.count || 0)])
    );
    if (Object.keys(fromFunnel).length) {
      return {
        generated: fromFunnel.leads || 0,
        connected: fromFunnel.connected || 0,
        qualified: fromFunnel.qualified || 0,
        quotations: fromFunnel.quotations || 0,
        bookings: fromFunnel.bookings || 0,
      };
    }
    return {
      generated: rows.reduce((s, r) => s + (Number(r.leadsGenerated) || 0), 0),
      connected: rows.reduce((s, r) => s + (Number(r.connectedLeads) || 0), 0),
      qualified: rows.reduce((s, r) => s + (Number(r.qualifiedLeads) || 0), 0),
      quotations: rows.reduce((s, r) => s + (Number(r.quotationLeads) || 0), 0),
      bookings: rows.reduce((s, r) => s + (Number(r.convertedLeads) || 0), 0),
    };
  }, [rows, stats]);

  const summary = [
    { label: 'Generated', value: totals.generated, color: 'text-violet-600' },
    { label: 'Connected', value: totals.connected, color: 'text-emerald-600' },
    { label: 'Qualified', value: totals.qualified, color: 'text-orange-500' },
    { label: 'Quotations', value: totals.quotations, color: 'text-pink-500' },
    { label: 'Bookings', value: totals.bookings, color: 'text-blue-600' },
  ];

  return (
    <DashboardPanel
      title={`Lead Trend (${range.label})`}
      className="h-full"
      action={
        <label className="relative inline-flex items-center">
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-violet-400"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
        </label>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {summary.map((s) => (
          <div key={s.label} className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">{s.label}</p>
            <p className={`text-base font-bold tabular-nums leading-tight ${s.color}`}>
              {Number(s.value || 0).toLocaleString('en-IN')}
            </p>
          </div>
        ))}
      </div>

      <div className="h-[220px] w-full sm:h-[240px]">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="leadTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="leadsGenerated"
                name="Generated"
                stroke="#7C3AED"
                strokeWidth={2.5}
                fill="url(#leadTrendFill)"
                dot={{ r: 3.5, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#7C3AED', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            No trend data yet
          </p>
        )}
      </div>
    </DashboardPanel>
  );
}
