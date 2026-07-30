import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Medal, Trophy, TrendingUp, PhoneCall, Target, IndianRupee, Users } from 'lucide-react';
import {
  useReactTable, getCoreRowModel, flexRender, createColumnHelper,
} from '@tanstack/react-table';
import API from '../../api/axios';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import PageHeader from '../ui/PageHeader';
import { formatCurrency } from './managerUtils';
import SetMonthlyTargetModal from '../sales-targets/SetMonthlyTargetModal';
import { fetchSalesTargets } from '../../services/salesTargetsApi';
const columnHelper = createColumnHelper();

export default function TeamPerformancePage() {
  const [executives, setExecutives] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState(null);

  const fetchExecutives = () => {
    setLoading(true);
    Promise.all([
      API.get('/sales-manager/executives', { skipSuccessToast: true }),
      fetchSalesTargets(),
    ])
      .then(([execRes, targets]) => {
        setExecutives(execRes.data);
        setLeaders((targets || []).filter((t) => t.role === 'team_leader'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExecutives();
  }, []);

  useDataRefresh(['leads', 'followups', 'quotations', 'dashboard'], fetchExecutives);
  const columns = useMemo(() => [
    columnHelper.accessor('rank', { header: 'Rank', cell: (i) => (
      <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-bold ${i.getValue() === 1 ? 'bg-amber-500/20 text-amber-600' : 'bg-surface-elevated text-content-muted'}`}>
        {i.getValue() === 1 ? <Medal className="w-3.5 h-3.5" /> : i.getValue()}
      </span>
    ) }),
    columnHelper.accessor('name', { header: 'Executive', cell: (i) => <span className="font-semibold text-content-primary">{i.getValue()}</span> }),
    columnHelper.accessor('assignedLeads', { header: 'Leads Assigned' }),
    columnHelper.accessor((r) => r.temperature?.cold ?? 0, { id: 'cold', header: 'Cold' }),
    columnHelper.accessor((r) => r.temperature?.warm ?? 0, { id: 'warm', header: 'Warm' }),
    columnHelper.accessor((r) => r.temperature?.hot ?? 0, { id: 'hot', header: 'Hot' }),
    columnHelper.accessor('contacted', { header: 'Contacted' }),
    columnHelper.accessor('followUpsDone', { header: 'Follow-ups' }),
    columnHelper.accessor('quotationsSent', { header: 'Quotations' }),
    columnHelper.accessor('conversions', { header: 'Converted' }),
    columnHelper.accessor((r) => r.byStatus?.lost ?? 0, { id: 'lost', header: 'Lost' }),
    columnHelper.accessor('revenue', { header: 'Revenue', cell: (i) => <span className="font-bold tabular-nums">{formatCurrency(i.getValue())}</span> }),
    columnHelper.accessor('monthlyTarget', { header: 'Target', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue())}</span> }),
    columnHelper.accessor('packageTarget', { header: 'Package', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue() || 0)}</span> }),
    columnHelper.accessor('totalSalesTarget', { header: 'Total sales', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue() || 0)}</span> }),
    columnHelper.accessor('profitTarget', { header: 'Profit', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue() || 0)}</span> }),
    columnHelper.accessor('targetProgress', { header: 'Target %', cell: (i) => <span className="text-sky-700 font-semibold">{i.getValue() ?? 0}%</span> }),
    columnHelper.accessor('conversionRate', { header: 'CR %', cell: (i) => <span className="text-emerald-600 font-semibold">{i.getValue()}%</span> }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/leads?agent=${row.original._id}`}
            className="text-xs font-semibold text-violet-700 hover:underline"
          >
            View leads
          </Link>
          <button type="button" onClick={() => setTargetUser(row.original)} className="text-xs font-semibold text-sky-700 hover:underline">
            Set target
          </button>
        </div>
      ),
    }),
  ], []);

  const table = useReactTable({ data: executives, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-6">
      <PageHeader title="Team Performance" description="Set Target / Package / Total sales / Profit for executives and team leaders (monthly or daily)" breadcrumbs={['Team', 'Sales Targets']} />

      {!loading && leaders.length > 0 && (
        <div className="rounded-2xl border border-subtle bg-surface/80 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-content-muted">Team leader targets</p>
            <p className="text-[11px] text-content-muted">Target · Package · Total sales · Profit</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-subtle bg-surface-elevated/50">
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Team Leader</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Target</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Package</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Total sales</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Profit</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Period</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {leaders.map((tl) => (
                  <tr key={tl.userId} className="hover:bg-sky-500/[0.03]">
                    <td className="px-3 py-3 font-semibold text-content-primary">{tl.name}</td>
                    <td className="px-3 py-3 tabular-nums">{formatCurrency(tl.revenueTarget || 0)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatCurrency(tl.packageTarget || 0)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatCurrency(tl.totalSalesTarget || 0)}</td>
                    <td className="px-3 py-3 tabular-nums">{formatCurrency(tl.profitTarget || 0)}</td>
                    <td className="px-3 py-3 text-xs capitalize text-content-muted">
                      {tl.periodType === 'daily' ? `Daily × ${tl.workingDays || 26}d` : 'Monthly'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setTargetUser(tl)}
                        className="text-xs font-semibold text-sky-700 hover:underline"
                      >
                        Set target
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {!loading && executives.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-subtle bg-surface/60 p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3 text-content-muted opacity-50" />
            <p className="font-medium text-content-primary">No active sales executives</p>
            <p className="text-sm text-content-muted mt-1">Add Sales Executives from Team Management to view performance here.</p>
          </div>
        ) : executives.map((ex) => (
          <div key={ex._id} className="relative overflow-hidden rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 flex items-center justify-center text-white font-bold text-xs">
                {ex.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-bold text-sm text-content-primary">{ex.name}</p>
                <p className="text-xs text-content-muted">Rank #{ex.rank}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-surface-elevated/50"><Target className="w-3 h-3 text-content-muted mb-0.5" /><p className="text-content-muted">Leads</p><p className="font-bold">{ex.assignedLeads}</p></div>
              <div className="p-2 rounded-lg bg-surface-elevated/50"><PhoneCall className="w-3 h-3 text-content-muted mb-0.5" /><p className="text-content-muted">Follow-ups</p><p className="font-bold">{ex.followUpsDone}</p></div>
              <div className="p-2 rounded-lg bg-surface-elevated/50"><Trophy className="w-3 h-3 text-content-muted mb-0.5" /><p className="text-content-muted">Conv.</p><p className="font-bold">{ex.conversions}</p></div>
              <div className="p-2 rounded-lg bg-surface-elevated/50"><IndianRupee className="w-3 h-3 text-content-muted mb-0.5" /><p className="text-content-muted">Revenue</p><p className="font-bold">{formatCurrency(ex.revenue)}</p></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">Cold {ex.temperature?.cold || 0}</span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Warm {ex.temperature?.warm || 0}</span>
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">Hot {ex.temperature?.hot || 0}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">Converted {ex.conversions || 0}</span>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Lost {ex.byStatus?.lost || 0}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {ex.conversionRate}% conversion</p>
              <Link to={`/leads?agent=${ex._id}`} className="text-[10px] font-bold text-violet-600 hover:underline">Check leads →</Link>
            </div>
          </div>
        ))}
      </motion.div>

      {!loading && executives.length > 0 && (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {executives.slice(0, 3).map((ex, i) => (
          <div key={ex._id} className={`rounded-2xl border p-5 backdrop-blur-xl ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-subtle bg-surface/80'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className={`w-5 h-5 ${i === 0 ? 'text-amber-500' : 'text-content-muted'}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-content-muted">#{ex.rank} Performer</span>
            </div>
            <p className="text-lg font-bold text-content-primary">{ex.name}</p>
            <p className="text-sm text-content-secondary mt-1">{formatCurrency(ex.revenue)} · {ex.conversionRate}% CR</p>
          </div>
        ))}
      </motion.div>
      )}

      <div className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-content-muted">Loading…</div>
        ) : executives.length === 0 ? (
          <div className="p-16 text-center text-content-muted">Performance data tab dikhegi jab executives assign honge.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-subtle bg-surface-elevated/50">
                    {hg.headers.map((h) => (
                      <th key={h.id} className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted whitespace-nowrap">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-subtle">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-violet-500/[0.03]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5 text-content-secondary whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SetMonthlyTargetModal
        open={!!targetUser}
        user={targetUser}
        onClose={() => setTargetUser(null)}
        onSaved={fetchExecutives}
      />
    </div>
  );
}
