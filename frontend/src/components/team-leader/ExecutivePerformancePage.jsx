import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Medal, Trophy, TrendingUp, PhoneCall, Target, IndianRupee, FileText } from 'lucide-react';
import {
  useReactTable, getCoreRowModel, flexRender, createColumnHelper,
} from '@tanstack/react-table';
import API from '../../api/axios';
import PageHeader from '../ui/PageHeader';
import { formatCurrency } from './leaderUtils';
import SetMonthlyTargetModal from '../sales-targets/SetMonthlyTargetModal';

const columnHelper = createColumnHelper();

export default function ExecutivePerformancePage() {
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState(null);

  useEffect(() => {
    API.get('/team-leader/executives').then((r) => setExecutives(r.data)).finally(() => setLoading(false));
  }, []);

  const columns = useMemo(() => [
    columnHelper.accessor('rank', {
      header: 'Rank',
      cell: (i) => (
        <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-xs font-bold ${i.getValue() === 1 ? 'bg-amber-500/20 text-amber-600' : 'bg-surface-elevated text-content-muted'}`}>
          {i.getValue() === 1 ? <Medal className="w-4 h-4" /> : i.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('name', { header: 'Executive', cell: (i) => <span className="font-semibold">{i.getValue()}</span> }),
    columnHelper.accessor('assignedLeads', { header: 'Assigned Leads' }),
    columnHelper.accessor('followUpsDone', { header: 'Follow-ups Done' }),
    columnHelper.accessor('quotationsSent', { header: 'Quotations Sent' }),
    columnHelper.accessor('conversions', { header: 'Converted' }),
    columnHelper.accessor('revenue', { header: 'Revenue', cell: (i) => <span className="font-bold tabular-nums">{formatCurrency(i.getValue())}</span> }),
    columnHelper.accessor('monthlyTarget', { header: 'Target', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue())}</span> }),
    columnHelper.accessor('packageTarget', { header: 'Package total', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue() || 0)}</span> }),
    columnHelper.accessor('totalSalesTarget', { header: 'Total sales', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue() || 0)}</span> }),
    columnHelper.accessor('profitTarget', { header: 'Profit', cell: (i) => <span className="tabular-nums">{formatCurrency(i.getValue() || 0)}</span> }),
    columnHelper.accessor('targetProgress', { header: 'Target %', cell: (i) => <span className="text-sky-700 font-semibold">{i.getValue() ?? 0}%</span> }),
    columnHelper.accessor('conversionRate', { header: 'CR %', cell: (i) => <span className="text-emerald-600 font-semibold">{i.getValue()}%</span> }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button type="button" onClick={() => setTargetUser(row.original)} className="text-xs font-semibold text-amber-700 hover:underline">
          Set target
        </button>
      ),
    }),
  ], []);

  const table = useReactTable({ data: executives, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-6">
      <PageHeader title="Executive Performance" description="Set monthly targets and track squad revenue" breadcrumbs={['Team Leader', 'Executive Performance']} />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {executives.slice(0, 3).map((ex, i) => (
          <div key={ex._id} className={`relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl ${i === 0 ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5' : 'border-subtle bg-surface/80'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className={`w-5 h-5 ${i === 0 ? 'text-amber-500' : 'text-content-muted'}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-content-muted">Rank #{ex.rank}</span>
            </div>
            <p className="text-xl font-bold text-content-primary">{ex.name}</p>
            <p className="text-sm text-content-secondary mt-1">{formatCurrency(ex.revenue)} revenue</p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
              <div className="p-2 rounded-lg bg-surface-elevated/50 text-center"><Target className="w-3 h-3 mx-auto mb-0.5 text-content-muted" /><p className="font-bold">{ex.assignedLeads}</p><p className="text-content-muted">Leads</p></div>
              <div className="p-2 rounded-lg bg-surface-elevated/50 text-center"><PhoneCall className="w-3 h-3 mx-auto mb-0.5 text-content-muted" /><p className="font-bold">{ex.followUpsDone}</p><p className="text-content-muted">F/U</p></div>
              <div className="p-2 rounded-lg bg-surface-elevated/50 text-center"><FileText className="w-3 h-3 mx-auto mb-0.5 text-content-muted" /><p className="font-bold">{ex.quotationsSent}</p><p className="text-content-muted">Quotes</p></div>
            </div>
            <p className="text-xs text-emerald-600 font-semibold mt-3 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {ex.conversionRate}% conversion · {ex.conversions} won</p>
          </div>
        ))}
      </motion.div>

      <div className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-content-muted">Loading…</div>
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
                  <tr key={row.id} className="hover:bg-amber-500/[0.03]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
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
        onSaved={() => API.get('/team-leader/executives').then((r) => setExecutives(r.data))}
      />
    </div>
  );
}
