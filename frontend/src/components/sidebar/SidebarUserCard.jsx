import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '../../context/SidebarContext';
import { useSidebarTheme } from './SidebarThemeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

function getInitials(name) {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

export default function SidebarUserCard({ user }) {
  const { collapsed, setMobileOpen } = useSidebar();
  const { accent, profilePath } = useSidebarTheme();
  const initials = getInitials(user?.name);

  const profileCard = (
    <Link
      to={profilePath}
      onClick={() => setMobileOpen(false)}
      onPointerDown={() => setMobileOpen(false)}
      className={cn(
        'flex items-center gap-3 min-w-0 rounded-2xl border border-sidebar-border/80 bg-white/50 backdrop-blur-md p-2.5 transition-colors hover:bg-white/70 dark:bg-slate-900/45 dark:hover:bg-slate-900/60',
        collapsed && 'p-2 justify-center'
      )}
    >
      <div className="relative shrink-0">
        <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white shadow-md', accent.avatarGradient)}>
          {initials}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
      </div>

      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-sidebar-text truncate">{user?.name || 'User'}</p>
          <p className="text-[11px] text-sidebar-muted truncate">{user?.roleName || user?.role || 'Agent'}</p>
          <p className="text-[10px] font-medium text-emerald-500 mt-0.5">● Online</p>
        </div>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <div className="p-3 border-t border-sidebar-border">
        <Tooltip>
          <TooltipTrigger asChild>{profileCard}</TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-semibold">{user?.name}</p>
            <p className="text-content-muted">{user?.roleName || user?.role} · Online</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 border-t border-sidebar-border"
      >
        {profileCard}
      </motion.div>
    </AnimatePresence>
  );
}
