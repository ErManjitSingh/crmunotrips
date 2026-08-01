import { Headphones, ArrowRight } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

export default function ManagerSidebarHelp() {
  const { collapsed } = useSidebar();
  if (collapsed) return null;

  return (
    <div className="px-3 pb-3">
      <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-800 p-3.5 shadow-lg shadow-violet-950/40">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <Headphones className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Need Help?</p>
            <p className="mt-0.5 text-[11px] leading-snug text-violet-100/80">
              Contact support for CRM tips, training &amp; escalations.
            </p>
          </div>
        </div>
        <a
          href="mailto:support@unotrips.com"
          className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-white text-[11px] font-bold text-violet-700 shadow-sm transition hover:bg-violet-50"
        >
          Get Support <ArrowRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
