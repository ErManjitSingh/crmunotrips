import { Link } from 'react-router-dom';

const ACCENT_STYLES = {
  brand: {
    active: 'text-brand-600',
    primary: 'from-brand-600 to-brand-700 shadow-brand-600/40',
  },
  sky: {
    active: 'text-sky-600',
    primary: 'from-sky-600 to-sky-700 shadow-sky-600/40',
  },
  violet: {
    active: 'text-violet-600',
    primary: 'from-violet-600 to-purple-700 shadow-violet-600/40',
  },
  amber: {
    active: 'text-amber-600',
    primary: 'from-amber-500 to-orange-600 shadow-amber-500/40',
  },
  teal: {
    active: 'text-teal-600',
    primary: 'from-teal-500 to-cyan-700 shadow-teal-500/40',
  },
  emerald: {
    active: 'text-emerald-600',
    primary: 'from-emerald-500 to-teal-700 shadow-emerald-500/40',
  },
  sunset: {
    active: 'text-orange-600',
    primary: 'from-orange-500 to-rose-600 shadow-orange-500/40',
  },
};

export default function MobileBottomNav({ tabs, isActive, accent = 'brand' }) {
  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.brand;

  return (
    <nav className="glass-panel safe-area-pb fixed inset-x-0 bottom-0 z-30 border-t border-subtle lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);

          if (tab.primary) {
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex flex-col items-center -mt-5"
                aria-label={tab.label}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${styles.primary} flex items-center justify-center shadow-lg text-white`}
                >
                  <Icon className="w-6 h-6" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                active ? styles.active : 'text-content-muted'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
