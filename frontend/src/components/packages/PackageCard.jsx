import { motion } from 'framer-motion';
import { MapPin, Clock, IndianRupee, Copy, Pencil, Trash2, Globe2 } from 'lucide-react';
import { PACKAGE_TYPES } from '../quotations/constants';
import { formatINR } from '../quotations/quotationUtils';
import { cn } from '../../lib/utils';

export default function PackageCard({ pkg, index, onEdit, onDelete, onDuplicate }) {
  const typeCfg = PACKAGE_TYPES.find((t) => t.value === pkg.packageType) || PACKAGE_TYPES[1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn('group rounded-2xl border bg-gradient-to-br backdrop-blur-sm overflow-hidden hover:shadow-lg transition-all', typeCfg.color)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center">
            <Globe2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20">{typeCfg.label}</span>
        </div>
        <h3 className="text-base font-bold text-content-primary mb-1">{pkg.name}</h3>
        <div className="flex flex-wrap gap-3 text-xs text-content-secondary mt-2">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {pkg.destination}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {pkg.duration}D/{pkg.duration - 1}N</span>
          <span className="flex items-center gap-1 font-bold text-content-primary"><IndianRupee className="w-3 h-3" /> {formatINR(pkg.startingPrice).replace('₹', '')}</span>
          {pkg.destinationMarginApplied && Number(pkg.destinationMarginPercent) > 0 && (
            <span className="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300">
              +{pkg.destinationMarginPercent}% margin
            </span>
          )}
        </div>
        <p className="text-xs text-content-muted mt-2">{pkg.itinerary?.length || 0} day itinerary</p>
      </div>
      <div className="px-5 py-3 border-t border-white/20 dark:border-black/10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/30 dark:bg-black/10">
        <button type="button" onClick={() => onEdit(pkg)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium hover:bg-white/50 dark:hover:bg-black/20"><Pencil className="w-3 h-3" /> Edit</button>
        <button type="button" onClick={() => onDuplicate(pkg._id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium hover:bg-white/50 dark:hover:bg-black/20"><Copy className="w-3 h-3" /> Duplicate</button>
        <button type="button" onClick={() => onDelete(pkg._id)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </motion.div>
  );
}
