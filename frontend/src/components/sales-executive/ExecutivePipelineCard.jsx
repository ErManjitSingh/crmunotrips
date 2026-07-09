import { Link } from 'react-router-dom';
import { BarChart3, User } from 'lucide-react';

export default function ExecutivePipelineCard() {
  return (
    <div className="hidden xl:flex flex-col items-center justify-center shrink-0 w-[168px] rounded-2xl border border-subtle bg-white dark:bg-slate-900 shadow-sm p-4">
      <div className="relative w-full h-[88px] mb-3 flex items-end justify-center" aria-hidden>
        <div className="absolute top-0 left-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-[#5D5FEF]/15 border border-[#5D5FEF]/25 flex items-center justify-center"
              style={{ transform: `translateY(${i * 2}px)` }}
            >
              <User className="w-3 h-3 text-[#5D5FEF]" />
            </div>
          ))}
        </div>
        <svg viewBox="0 0 120 72" className="w-[120px] h-[72px]" fill="none">
          <path
            d="M10 8 L110 8 L92 32 L28 32 Z"
            fill="#5D5FEF"
            fillOpacity="0.12"
            stroke="#5D5FEF"
            strokeWidth="1.5"
            strokeOpacity="0.35"
          />
          <path
            d="M28 36 L92 36 L76 56 L44 56 Z"
            fill="#5D5FEF"
            fillOpacity="0.2"
            stroke="#5D5FEF"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          <path
            d="M44 60 L76 60 L68 70 L52 70 Z"
            fill="#5D5FEF"
            fillOpacity="0.35"
            stroke="#5D5FEF"
            strokeWidth="1.5"
            strokeOpacity="0.55"
          />
        </svg>
      </div>
      <Link
        to="/sales-executive/dashboard"
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-subtle bg-white dark:bg-slate-900 text-xs font-semibold text-content-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
      >
        <BarChart3 className="w-3.5 h-3.5 text-[#5D5FEF]" />
        View Pipeline
      </Link>
    </div>
  );
}
