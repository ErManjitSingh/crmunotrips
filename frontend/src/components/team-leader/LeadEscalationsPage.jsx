import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Flame, MessageSquareWarning, ArrowUpCircle } from 'lucide-react';
import API from '../../api/axios';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { BudgetBadge, DestinationChip, ExecutiveBadge, ManagerStatusBadge, CustomerCell } from '../sales-manager/LeadListBadges';
import { formatCurrency } from './leaderUtils';
import VirtualizedList from '../ui/VirtualizedList';
import { toast } from '../../context/ToastContext';

const SECTION_META = {
  stuck: { title: 'Stuck Leads', desc: 'No progress in 5+ days — needs intervention', icon: AlertTriangle, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-600' },
  highValue: { title: 'High Value Leads', desc: 'Budget ≥ ₹2L — manager visibility recommended', icon: Flame, iconBg: 'bg-rose-500/10', iconColor: 'text-rose-600' },
  complaints: { title: 'Complaint Cases', desc: 'Customer issues requiring escalation', icon: MessageSquareWarning, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-600' },
};

export default function LeadEscalationsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [escalating, setEscalating] = useState(null);

  const fetchData = () => {
    setLoading(true);
    API.get('/team-leader/escalations').then((r) => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleEscalate = async (item, type) => {
    setEscalating(item._id);
    await API.post('/team-leader/escalations', { _id: item._id, leadName: item.name, type });
    setEscalating(null);
    toast.success(`${item.name} escalated to Sales Manager`);
    fetchData();
  };

  if (loading) return <div className="py-20 text-center text-content-muted">Loading…</div>;

  return (
    <div className="space-y-8">
      <PageHeader title="Lead Escalations" description="Stuck leads, high-value cases, and complaints — escalate to Sales Manager" breadcrumbs={['Team Leader', 'Escalations']} />

      {Object.entries(SECTION_META).map(([key, { title, desc, icon: Icon, iconBg, iconColor }], si) => {
        const items = data?.[key] || [];
        return (
          <motion.section key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: si * 0.08 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${iconBg}`}><Icon className={`w-5 h-5 ${iconColor}`} /></div>
              <div>
                <h2 className="font-bold text-content-primary">{title}</h2>
                <p className="text-sm text-content-muted">{desc}</p>
              </div>
              <span className="ml-auto text-sm font-bold tabular-nums text-content-secondary">{items.length}</span>
            </div>

            <div className="rounded-2xl border border-subtle bg-white shadow-sm overflow-hidden">
              {items.length === 0 ? (
                <div className="p-8 text-center text-content-muted text-sm">No cases</div>
              ) : (
                <VirtualizedList
                  items={items}
                  estimateSize={key === 'complaints' ? 100 : 120}
                  maxHeight="min(60vh, 480px)"
                  renderItem={(item, index) => (
                    <div className={`p-4 flex flex-col lg:flex-row lg:items-center gap-4 border-b border-slate-100 last:border-0 ${index % 2 === 0 ? 'bg-sky-50' : 'bg-white'}`}>
                      <div className="flex-1 min-w-0 space-y-2">
                        {key === 'complaints' ? (
                          <>
                            <CustomerCell name={item.name} lead={item} />
                            <p className="text-sm text-content-secondary pl-10">{item.destination} · {item.executive}</p>
                            <p className="text-xs text-rose-600 font-medium pl-10">{item.reason}</p>
                            <p className="text-xs text-content-muted pl-10">{formatCurrency(item.budget)}</p>
                          </>
                        ) : (
                          <>
                            <CustomerCell name={item.name} lead={item} />
                            <div className="flex flex-wrap gap-2">
                              <DestinationChip name={item.destination} />
                              <BudgetBadge amount={item.budget} />
                              <ExecutiveBadge name={item.assignedTo?.name} />
                              {item.status && <ManagerStatusBadge status={item.status} />}
                            </div>
                            <p className="text-xs text-amber-600 font-medium">{item.reason}{item.daysStuck ? ` · ${item.daysStuck} days stuck` : ''}</p>
                          </>
                        )}
                      </div>
                      <div className="shrink-0">
                        {item.escalated ? (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full">Escalated</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={escalating === item._id}
                            onClick={() => handleEscalate(item, key)}
                            className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> Escalate to Manager
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                />
              )}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
