import { Crown } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

export default function SidebarUpgradeCard() {
  const { collapsed } = useSidebar();

  if (collapsed) return null;

  return (
    <div className="px-2 pb-3">
      <div className="rounded-2xl border border-white/[0.08] p-4 bg-gradient-to-br from-[#1e2245] via-[#171b35] to-[#12162B] shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-amber-400 shrink-0" strokeWidth={2} />
          <p className="text-sm font-semibold text-white">Upgrade Your Plan</p>
        </div>
        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          Unlock advanced analytics, unlimited leads, and priority support.
        </p>
        <button
          type="button"
          className="w-full h-9 rounded-xl bg-[#5D5FEF] hover:bg-[#4F51E0] text-white text-sm font-semibold transition-colors shadow-lg shadow-[#5D5FEF]/25"
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
}
