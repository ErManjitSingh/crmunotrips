import { Link } from 'react-router-dom';
import { useSidebar } from '../../context/SidebarContext';
import { useSidebarTheme } from './SidebarThemeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import { prefetchRoute } from '../../lib/routePrefetch';

const ACCENT_STYLES = {
  orange: {
    idle: 'text-orange-400/90 group-hover:text-orange-300',
    iconIdle: 'text-orange-400/80 group-hover:text-orange-300',
    active: 'bg-orange-500/90 text-white shadow-md shadow-orange-500/25',
    indicator: 'bg-orange-400',
    badge: 'bg-orange-500/25 text-orange-200',
  },
  blue: {
    idle: 'text-blue-400/90 group-hover:text-blue-300',
    iconIdle: 'text-blue-400/80 group-hover:text-blue-300',
    active: 'bg-blue-500 text-white shadow-md shadow-blue-500/30',
    indicator: 'bg-blue-400',
    badge: 'bg-blue-500/25 text-blue-200',
  },
  green: {
    idle: 'text-emerald-400/90 group-hover:text-emerald-300',
    iconIdle: 'text-emerald-400/80 group-hover:text-emerald-300',
    active: 'bg-emerald-600/90 text-white shadow-md shadow-emerald-500/25',
    indicator: 'bg-emerald-400',
    badge: 'bg-emerald-500/25 text-emerald-200',
  },
  red: {
    idle: 'text-red-400/90 group-hover:text-red-300',
    iconIdle: 'text-red-400/80 group-hover:text-red-300',
    active: 'bg-red-500/90 text-white shadow-md shadow-red-500/25',
    indicator: 'bg-red-400',
    badge: 'bg-red-500/25 text-red-200',
  },
};

export default function SidebarNavItem({ item, isActive, nested = false }) {
  const { collapsed, setMobileOpen } = useSidebar();
  const { accent } = useSidebarTheme();
  const Icon = item.icon;
  const accentStyle = item.accent ? ACCENT_STYLES[item.accent] : null;

  const linkContent = (
    <Link
      to={item.path}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
      onClick={() => {
        // Defer close so React Router can finish navigation first.
        window.setTimeout(() => setMobileOpen(false), 0);
      }}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-200',
        nested ? 'px-3 py-2 ml-0.5' : 'px-3 py-2.5',
        collapsed ? 'justify-center px-0 py-2.5' : '',
        isActive
          ? accentStyle
            ? accentStyle.active
            : cn(accent.itemActive)
          : cn(
              accentStyle ? accentStyle.idle : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
            )
      )}
    >
      {isActive && !collapsed && (
        <span
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full',
            accentStyle ? accentStyle.indicator : accent.indicator
          )}
        />
      )}

      <Icon
        className={cn(
          'shrink-0',
          nested ? 'w-4 h-4' : 'w-[18px] h-[18px]',
          isActive
            ? 'text-white'
            : accentStyle
              ? accentStyle.iconIdle
              : 'text-slate-400 group-hover:text-slate-200'
        )}
        strokeWidth={isActive ? 2.25 : 2}
      />

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {(() => {
              const n = item.badge ?? item.count;
              if (n === undefined || n <= 0) return null;
              return (
                <span
                  className={cn(
                    'text-[10px] font-bold tabular-nums min-w-[1.25rem] text-center px-1.5 py-0.5 rounded-md',
                    isActive
                      ? 'bg-white/20 text-white'
                      : accentStyle
                        ? accentStyle.badge
                        : accent.badge || 'bg-[#5D5FEF]/20 text-violet-300'
                  )}
                >
                  {n > 999 ? '999+' : n}
                </span>
              );
            })()}
          </div>
        </>
      )}

      {collapsed && (item.badge > 0 || item.count > 0) && (
        <span
          className={cn(
            'absolute top-1.5 right-2 w-2 h-2 rounded-full ring-2 ring-[#0f172a]',
            item.accent === 'orange'
              ? 'bg-orange-500'
              : item.accent === 'red'
                ? 'bg-red-500'
                : 'bg-[#5D5FEF]'
          )}
        />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2 font-medium">
          {item.label}
          {(item.badge > 0 || item.count > 0) ? ` (${item.badge ?? item.count})` : ''}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}
