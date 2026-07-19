import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { STATUS_FILTERS } from './constants';
import WhatsAppLeadListItem from './WhatsAppLeadListItem';

export default function WhatsAppLeadList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  loading,
}) {
  return (
    <div className="flex flex-col h-full bg-wa-panel border-r border-wa-border">
      <div className="shrink-0 p-3 space-y-3 border-b border-wa-border bg-wa-header/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-wa-text-primary tracking-tight">WhatsApp Leads</h2>
          <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            {conversations.length} chats
          </span>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-wa-input border border-wa-border text-sm text-wa-text-primary placeholder:text-wa-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onStatusFilterChange(f.key)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all',
                statusFilter === f.key
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
                  : 'bg-wa-input text-wa-text-secondary hover:bg-wa-list-hover border border-wa-border'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-wa-input" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-wa-input rounded w-2/3" />
                  <div className="h-2 bg-wa-input rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-wa-input flex items-center justify-center mb-3">
              <Search className="w-7 h-7 text-wa-text-muted" />
            </div>
            <p className="text-sm font-medium text-wa-text-primary">No conversations found</p>
            <p className="text-xs text-wa-text-muted mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {conversations.map((conv) => (
              <WhatsAppLeadListItem
                key={conv._id}
                conversation={conv}
                active={selectedId === (conv.conversationId || conv._id) || selectedId === conv.leadId}
                onClick={() => onSelect(conv)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
