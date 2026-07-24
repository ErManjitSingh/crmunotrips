import { useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Moon,
  Sun,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  ChevronDown,
  ShieldCheck,
  UserRound,
  Home,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LOGIN_PRESETS } from '../auth';
import { AuthError } from '../auth/authService';
import { cn } from '../lib/utils';
import { APP_BRAND_NAME } from '../config/branding';

const FEATURES = [
  { icon: ShieldCheck, title: 'Secure Login', subtitle: '256-bit Encryption' },
  { icon: UserRound, title: 'Role Based Access', subtitle: 'Multi-level Security' },
  { icon: Home, title: 'Always Protected', subtitle: 'Daily Data Backup' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('crm_remember') === '1');
  const [langOpen, setLangOpen] = useState(false);
  const [activePreset, setActivePreset] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, getDashboardPath } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  if (user) {
    const dest = user.dashboardPath || getDashboardPath(user.role);
    return <Navigate to={dest} replace />;
  }

  const fillPreset = (preset) => {
    setEmail(preset.email);
    setPassword(preset.password);
    setActivePreset(preset.email);
    setError('');
    setInfo('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      localStorage.setItem('crm_remember', rememberMe ? '1' : '0');
      const sessionUser = await login(email, password);
      const dest = sessionUser.dashboardPath || getDashboardPath(sessionUser.role);
      navigate(location.state?.from || dest, { replace: true });
    } catch (err) {
      const msg =
        err instanceof AuthError
          ? err.message
          : err.response?.data?.message
            || (err.message === 'Network Error'
              ? 'Cannot reach API. Check that the backend is running and you use http://testing.unotrips.com (SSL not configured yet).'
              : err.message)
            || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 sm:py-12 overflow-hidden bg-[#F7F6FB]">
      {/* Soft ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(139,92,246,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-violet-300/20 blur-3xl" />

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2.5 sm:top-5 sm:right-6">
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            'relative flex h-9 w-[3.25rem] items-center rounded-full border border-slate-200/80 bg-white shadow-sm transition-colors',
            isDark && 'border-violet-300 bg-violet-50',
          )}
          aria-label="Toggle theme"
        >
          <span
            className={cn(
              'absolute left-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-white shadow transition-transform',
              isDark && 'translate-x-[1.35rem] bg-violet-600',
            )}
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <Globe className="h-4 w-4 text-slate-500" />
            English
            <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', langOpen && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {langOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 mt-1.5 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                {['English', 'Hindi'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLangOpen(false)}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  >
                    {lang}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <div className="overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_25px_60px_-20px_rgba(109,40,217,0.28)]">
          <div className="px-7 pt-9 pb-7 sm:px-10 sm:pt-10 sm:pb-8">
            {/* Header */}
            <div className="mb-7 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#4F46E5] text-white shadow-lg shadow-violet-500/35">
                <Plane className="h-7 w-7" strokeWidth={2.2} />
              </div>
              <p
                className="mb-1 text-[1.65rem] font-semibold leading-none text-[#7C3AED]"
                style={{ fontFamily: '"Caveat", cursive' }}
              >
                Smile! You are part of the UNO family.
              </p>
              <h1 className="text-[1.55rem] font-bold tracking-tight text-[#1A1D2E] sm:text-[1.7rem]">
                Sign in to your account
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Access your {APP_BRAND_NAME} dashboard
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            )}
            {info && (
              <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-sm text-violet-700">
                {info}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#1A1D2E]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setActivePreset(null); }}
                    required
                    autoComplete="email"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[#1A1D2E]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 accent-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-500">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setInfo('Please contact your admin to reset your password.');
                    setError('');
                  }}
                  className="text-sm font-medium text-[#7C3AED] hover:text-violet-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#4F46E5] text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:from-[#7C3AED] hover:to-[#4338CA] disabled:opacity-60"
              >
                {loading ? 'Signing in…' : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Feature strip */}
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 bg-[#F8F7FC] px-4 py-4 sm:gap-3 sm:px-6">
            {FEATURES.map(({ icon: Icon, title, subtitle }) => (
              <div key={title} className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-2">
                <div className="mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 sm:mb-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold leading-tight text-[#1A1D2E] sm:text-xs">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-slate-500 sm:text-[11px]">{subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demo accounts */}
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quick demo login
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LOGIN_PRESETS.map((preset) => (
              <button
                key={preset.email}
                type="button"
                onClick={() => fillPreset(preset)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left text-sm transition',
                  activePreset === preset.email
                    ? 'border-violet-400 bg-violet-50 ring-2 ring-violet-400/20'
                    : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50',
                )}
              >
                <span className="block truncate text-xs font-semibold text-slate-800">{preset.roleName}</span>
                <span className="block truncate text-[11px] text-slate-500">{preset.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Password: <span className="font-mono font-semibold text-slate-600">123456</span>
            {' · '}
            <Link to="/hr/login" className="text-violet-600 hover:underline">HR Portal</Link>
          </p>
        </div>
      </motion.div>

      {/* Page footer */}
      <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-slate-500">
        <a href="#" className="hover:text-violet-600" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
        <span className="text-slate-300">•</span>
        <a href="#" className="hover:text-violet-600" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a>
        <span className="text-slate-300">•</span>
        <a href="#" className="hover:text-violet-600" onClick={(e) => e.preventDefault()}>Support</a>
      </div>
    </div>
  );
}
