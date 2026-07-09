import { motion } from 'framer-motion';
import { MapPin, Clock, Star, Sparkles, Eye } from 'lucide-react';
import { formatINR } from '../quotations/quotationUtils';
import { cn } from '../../lib/utils';

const TOUR_TYPE_STYLES = {
  domestic: 'bg-sky-500/10 text-sky-700 border-sky-400/30',
  international: 'bg-violet-500/10 text-violet-700 border-violet-400/30',
  honeymoon: 'bg-rose-500/10 text-rose-700 border-rose-400/30',
  adventure: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30',
  luxury: 'bg-amber-500/10 text-amber-800 border-amber-400/30',
};

function TourTypeBadge({ type }) {
  const label = type ? type.replace(/_/g, ' ') : 'package';
  return (
    <span
      className={cn(
        'inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
        TOUR_TYPE_STYLES[type] || TOUR_TYPE_STYLES.domestic
      )}
    >
      {label}
    </span>
  );
}

export default function UnoPackageGrid({ packages, onView }) {
  if (!packages.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
      {packages.map((pkg, i) => (
        <motion.article
          key={pkg._id || pkg.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="group rounded-2xl border border-amber-500/15 bg-surface/90 overflow-hidden shadow-sm hover:shadow-lg hover:border-amber-500/30 transition-all"
        >
          <div className="relative h-40 bg-surface-elevated overflow-hidden">
            {pkg.coverImage ? (
              <img
                src={pkg.coverImage}
                alt={pkg.name}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-content-muted text-sm">No image</div>
            )}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <TourTypeBadge type={pkg.packageType} />
              {pkg.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Sparkles className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <p className="text-[10px] font-mono text-content-muted">{pkg.packageCode || pkg.slug}</p>
              <h3 className="text-base font-bold text-content-primary line-clamp-2 mt-0.5">{pkg.name}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span className="line-clamp-1">{pkg.destination}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-amber-800 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {pkg.durationLabel || `${pkg.duration}D`}
              </span>
            </div>

            {pkg.shortDescription && (
              <p className="text-xs text-content-muted line-clamp-2">{pkg.shortDescription}</p>
            )}

            <div className="flex items-end justify-between gap-3 pt-1">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-content-muted">Starting from</p>
                <p className="text-lg font-bold text-content-primary tabular-nums">{formatINR(pkg.startingPrice)}</p>
              </div>
              {pkg.avgRating > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {pkg.avgRating}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onView(pkg)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold py-2.5 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View full details
            </button>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
