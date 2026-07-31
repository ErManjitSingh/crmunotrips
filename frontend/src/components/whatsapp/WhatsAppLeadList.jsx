import { memo } from 'react';
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { STATUS_FILTERS } from './constants';
import WhatsAppLeadListItem from './WhatsAppLeadListItem';

function WhatsAppLeadList({
  conversations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  loading,
  activeCount = 0,
  page = 1,
  pageSize = 20,
  total = 0,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil((total || conversations.length) / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total || conversations.length);

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80">
      <div className="shrink-0 p-4 space-y-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">WhatsApp Leads</h2>
            <p className="text-[11px] font-medium text-emerald-600 mt-0.5">
              {activeCount} chats active
            </p>
          </div>
          <button
            type="button"
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            aria-label="Filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key || 'all'}
                type="button"
                onClick={() => onStatusFilterChange(f.key)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border',
                  active
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-600/25'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 space-y-1">
        {loading ? (
          <div className="p-2 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse rounded-xl p-3">
                <div className="w-11 h-11 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-slate-100 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-3 border border-slate-100">
              <Search className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-700">No conversations found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const id = conv.conversationId || conv._id;
            return (
              <WhatsAppLeadListItem
                key={id}
                conversation={conv}
                active={selectedId === id || selectedId === conv.leadId}
                onClick={() => onSelect(conv)}
              />
            );
          })
        )}
      </div>

      <div className="shrink-0 px-3 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2 bg-white">
        <p className="text-[11px] text-slate-400">
          Showing {from} to {to} of {total || conversations.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-50 disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
            const p = Math.min(Math.max(page - 1, 1), Math.max(totalPages - 2, 1)) + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange?.(p)}
                className={cn(
                  'min-w-[28px] h-7 px-1.5 rounded-lg text-[11px] font-semibold',
                  p === page
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                )}
              >
                {p}
              </button>
            );
          })}
          {totalPages > 3 && (
            <>
              <span className="text-slate-300 text-xs px-0.5">…</span>
              <button
                type="button"
                onClick={() => onPageChange?.(totalPages)}
                className={cn(
                  'min-w-[28px] h-7 px-1.5 rounded-lg text-[11px] font-semibold',
                  page === totalPages ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                )}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
            className="p-1 rounded-md text-slate-400 hover:bg-slate-50 disabled:opacity-30"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(WhatsAppLeadList);
