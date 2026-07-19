import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

export default function ExecutivePipelineCta({ to = '/sales-executive/dashboard' }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#5D5FEF] via-[#6D5FF0] to-[#7C3AED] px-5 py-5 sm:px-7 sm:py-6 shadow-lg shadow-[#5D5FEF]/25">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -left-10 -bottom-12 w-36 h-36 rounded-full bg-black/10 pointer-events-none" />
      <div className="relative z-[1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white shrink-0">
            <TrendingUp className="w-5 h-5" />
          </span>
          <div>
            <p className="text-base sm:text-lg font-bold text-white tracking-tight">
              Convert more leads into happy customers
            </p>
            <p className="text-sm text-white/80 mt-0.5">
              Stay on top of follow-ups and close your pipeline faster.
            </p>
          </div>
        </div>
        <Link
          to={to}
          className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-white text-[#5D5FEF] text-sm font-bold shadow-md hover:bg-violet-50 transition-colors shrink-0"
        >
          View Your Pipeline
        </Link>
      </div>
    </div>
  );
}
