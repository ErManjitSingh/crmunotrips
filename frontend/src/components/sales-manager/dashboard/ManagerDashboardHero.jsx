import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function ManagerDashboardHero({ pendingFollowups = 0, newLeadsToday = 0, pendingQuotes = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#5B21B6] via-[#7C3AED] to-[#4338CA] shadow-xl shadow-violet-500/25"
    >
      <div
        className="absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="absolute inset-0 opacity-50 bg-[radial-gradient(ellipse_at_80%_20%,_rgba(255,255,255,0.22),_transparent_50%)]" />
      <div className="absolute -left-8 -bottom-20 h-48 w-48 rounded-full bg-fuchsia-400/30 blur-3xl" />
      <div className="absolute right-1/4 -top-10 h-32 w-32 rounded-full bg-sky-300/25 blur-2xl" />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-2 px-6 sm:px-8 py-7 sm:py-8">
        <div className="flex-1 min-w-0 z-10 max-w-xl">
          <h2 className="text-2xl sm:text-[1.75rem] font-bold text-white leading-snug tracking-tight">
            Your team has {pendingFollowups} follow-ups pending today.
          </h2>
          <p className="mt-2.5 text-sm sm:text-[15px] text-violet-100/95">
            {newLeadsToday} new leads arrived · {pendingQuotes} quotes need approval.
          </p>
          <Link
            to="/sales-manager/leads/all"
            className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-sm font-semibold text-violet-700 shadow-lg shadow-violet-950/20 hover:bg-violet-50 transition-colors"
          >
            View Today&apos;s Leads
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="relative shrink-0 w-full max-w-[300px] sm:max-w-[340px] lg:max-w-[400px] mx-auto lg:mx-0 lg:-mr-2 self-end">
          <img
            src="/sm-dashboard-hero-art.png"
            alt=""
            className="w-full h-auto object-contain drop-shadow-2xl pointer-events-none select-none"
            draggable={false}
          />
        </div>
      </div>
    </motion.div>
  );
}
