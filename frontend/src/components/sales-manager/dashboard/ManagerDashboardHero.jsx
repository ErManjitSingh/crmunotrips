import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, ArrowRight } from 'lucide-react';

export default function ManagerDashboardHero({ pendingFollowups = 0, newLeadsToday = 0, pendingQuotes = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-[#5B21B6] via-[#7C3AED] to-[#4F46E5] shadow-xl shadow-violet-500/20"
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.28),_transparent_55%)]" />
      <div className="absolute -left-10 -bottom-16 h-40 w-40 rounded-full bg-fuchsia-400/25 blur-3xl" />
      <div className="absolute right-1/3 top-0 h-28 w-28 rounded-full bg-sky-300/20 blur-2xl" />

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 px-5 sm:px-8 py-6 sm:py-7">
        <div className="flex-1 min-w-0 z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/20 mb-3">
            <Rocket className="w-3.5 h-3.5" />
            Manager Overview
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold text-white leading-snug max-w-xl tracking-tight">
            Your team has {pendingFollowups} follow-ups pending today.
          </h2>
          <p className="mt-2 text-sm text-violet-100/95">
            {newLeadsToday} new leads arrived · {pendingQuotes} quotes need approval.
          </p>
          <Link
            to="/sales-manager/leads/all"
            className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-white text-sm font-semibold text-violet-700 shadow-md hover:bg-violet-50 transition-colors"
          >
            View Today&apos;s Leads
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="relative shrink-0 w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[380px] mx-auto lg:mx-0 self-end lg:self-center">
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
