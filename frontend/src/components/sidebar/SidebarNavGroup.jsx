import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import SidebarNavItem from './SidebarNavItem';
import SidebarNavSubGroup from './SidebarNavSubGroup';
import { isNavItemActive } from './sidebar-utils';
import { cn } from '../../lib/utils';
import { useSidebarTheme } from './SidebarThemeContext';

function flattenSectionItems(sections = []) {
  return sections.flatMap((section) => section.items || []);
}

export default function SidebarNavGroup({ group, defaultOpen = false }) {
  const { collapsed } = useSidebar();
  const { accent } = useSidebarTheme();
  const location = useLocation();
  const Icon = group.icon;
  const hasSections = Boolean(group.sections?.length);
  const children = hasSections ? flattenSectionItems(group.sections) : group.children || [];

  const isChildActive = children.some((child) =>
    isNavItemActive(location.pathname, child.path)
  );

  const [open, setOpen] = useState(isChildActive || defaultOpen);

  const childBadgeSum = useMemo(
    () => children.reduce((sum, c) => sum + (c.badge || 0), 0),
    [children]
  );

  const displayBadge =
    group.badge !== undefined
      ? group.badge
      : childBadgeSum > 0
        ? childBadgeSum
        : undefined;

  useEffect(() => {
    if (defaultOpen || isChildActive) setOpen(true);
  }, [defaultOpen, isChildActive]);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(
                'w-full flex items-center justify-center py-2.5 rounded-xl transition-colors relative',
                isChildActive
                  ? cn(accent.itemActive)
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {displayBadge > 0 && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#5D5FEF] ring-2 ring-[#12162B]" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{group.label}</TooltipContent>
        </Tooltip>
        {hasSections
          ? group.sections.map((section) => (
              <SidebarNavSubGroup key={section.id} section={section} forceOpen />
            ))
          : children.map((child) => (
              <SidebarNavItem
                key={child.path}
                item={child}
                isActive={isNavItemActive(location.pathname, child.path)}
                nested
              />
            ))}
      </div>
    );
  }

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200',
          isChildActive
            ? cn(accent.groupActive, 'text-white')
            : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
        )}
      >
        {isChildActive && (
          <span className={cn('absolute left-0 w-[3px] h-6 rounded-r-full', accent.indicator)} />
        )}
        <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
        <span className="flex-1 text-left truncate">{group.label}</span>
        {displayBadge > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-[#5D5FEF]/20 text-violet-300 tabular-nums">
            {displayBadge > 999 ? '999+' : displayBadge}
          </span>
        )}
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'mt-0.5 ml-2 pl-2 border-l border-white/[0.08] py-1',
                hasSections ? 'space-y-1' : 'space-y-0.5'
              )}
            >
              {hasSections
                ? group.sections.map((section) => (
                    <SidebarNavSubGroup
                      key={section.id}
                      section={section}
                      forceOpen={defaultOpen}
                    />
                  ))
                : children.map((child) => (
                    <SidebarNavItem
                      key={child.path}
                      item={child}
                      nested
                      isActive={isNavItemActive(location.pathname, child.path)}
                    />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
