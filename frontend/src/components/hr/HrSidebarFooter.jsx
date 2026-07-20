import { Sparkles } from 'lucide-react';
import SidebarUserCard from '../sidebar/SidebarUserCard';
import { useSidebar } from '../../context/SidebarContext';
import { cn } from '../../lib/utils';

export default function HrSidebarFooter({ user }) {
  const { collapsed } = useSidebar();

  return (
    <div className="mt-auto border-t border-white/[0.06]">
      {!collapsed && (
        <div className="mx-3 mt-3 mb-2 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#5D5FEF]/20 to-indigo-600/10 p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5D5FEF]/30">
              <Sparkles className="h-4 w-4 text-violet-200" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white">Upgrade to Pro</p>
              <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                Unlock advanced analytics &amp; payroll automation
              </p>
            </div>
          </div>
        </div>
      )}
      <SidebarUserCard user={user} />
    </div>
  );
}
