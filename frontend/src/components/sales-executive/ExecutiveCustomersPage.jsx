import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Repeat } from 'lucide-react';
import API from '../../api/axios';
import ExecutivePageShell from './ExecutivePageShell';
import Avatar from '../ui/Avatar';
import { formatCurrency } from './executiveUtils';
import { executiveCard, executiveIconAccent, executiveSpinner } from './executivePageStyles';

export default function ExecutiveCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/sales-executive/customers')
      .then((r) => setCustomers(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ExecutivePageShell
      title="Customers"
      description="Converted clients, repeat travelers, and leads who already received a package"
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <div className={executiveSpinner} />
        </div>
      ) : customers.length === 0 ? (
        <div className={`${executiveCard} p-12 text-center text-content-muted`}>No customers yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {customers.map((c, i) => (
            <motion.div
              key={c._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`${executiveCard} p-5 hover:border-violet-500/20 transition-colors`}
            >
              <div className="flex items-start gap-4 mb-4">
                <Avatar name={c.name} size="md" className="ring-2 ring-violet-500/20" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-content-primary truncate">{c.name}</h3>
                    {c.trips > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                        <Repeat className="w-3 h-3" /> Repeat
                      </span>
                    )}
                    {c.packageShared && !c.converted && (
                      <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        Package shared
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-content-muted">{c.trips} trip{c.trips > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-content-secondary"><Mail className={`w-3.5 h-3.5 ${executiveIconAccent}`} /> {c.email}</p>
                <p className="flex items-center gap-2 text-content-secondary"><Phone className={`w-3.5 h-3.5 ${executiveIconAccent}`} /> {c.phone}</p>
                <p className="flex items-center gap-2 text-content-secondary"><MapPin className={`w-3.5 h-3.5 ${executiveIconAccent}`} /> {c.destination}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-subtle flex justify-between items-center">
                <span className="text-xs text-content-muted">Total spent</span>
                <span className="font-bold text-emerald-600 tabular-nums">{formatCurrency(c.totalSpent)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </ExecutivePageShell>
  );
}
