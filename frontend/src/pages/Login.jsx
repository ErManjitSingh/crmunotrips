import { useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane, Sun, Moon, Lock, Mail, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LOGIN_PRESETS } from '../auth';
import { AuthError } from '../auth/authService';
import { cn } from '../lib/utils';
import { APP_BRAND_NAME } from '../config/branding';

const BG_IMAGE = '/login-bg.jpg';
const [brandLead, ...brandRest] = APP_BRAND_NAME.split(' ');
const brandTail = brandRest.join(' ');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activePreset, setActivePreset] = useState(null);
  const [error, setError] = useState('');
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
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
    <div className="relative min-h-screen flex items-center justify-center p-5 sm:p-8 overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
      />
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-violet-500/10" />

      {/* Theme toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-20 p-2.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 text-slate-600 hover:bg-white/80 shadow-sm transition-all"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Centered card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/30 mb-4">
            <Plane className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            <span className="text-orange-600">{brandLead}</span>
            {brandTail ? ` ${brandTail}` : ''}
          </h1>
          <p className="text-sm text-slate-600 mt-1">Welcome back — sign in to continue</p>
        </div>

        {/* Glass form card */}
        <div className="rounded-2xl border border-white/60 bg-white/55 backdrop-blur-xl shadow-xl shadow-violet-500/10 p-7 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-400/30 text-rose-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setActivePreset(null); }}
                  required
                  autoComplete="email"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/70 border border-white/80 text-slate-800 placeholder:text-slate-400 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25 focus:bg-white/90"
                  placeholder="admin@crm.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/70 border border-white/80 text-slate-800 placeholder:text-slate-400 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25 focus:bg-white/90"
                  placeholder="••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-1 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/25 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? 'Signing in…' : (<>Sign In <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </form>
        </div>

        {/* Demo roles */}
        <div className="mt-5 rounded-2xl border border-white/50 bg-white/40 backdrop-blur-lg p-4 shadow-lg shadow-violet-500/5">
          <p className="text-xs font-semibold text-slate-600 mb-3 text-center uppercase tracking-wider">
            Quick demo login
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LOGIN_PRESETS.map((preset) => (
              <button
                key={preset.email}
                type="button"
                onClick={() => fillPreset(preset)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-xl border text-sm transition-all',
                  activePreset === preset.email
                    ? 'border-violet-400/60 bg-white/80 ring-2 ring-violet-400/30 shadow-sm'
                    : 'border-white/60 bg-white/50 hover:bg-white/75 hover:border-violet-300/50',
                )}
              >
                <span className="font-semibold text-slate-800 block truncate text-xs">{preset.roleName}</span>
                <span className="text-[11px] text-slate-500 truncate block">{preset.email}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 text-center mt-3">
            Password: <span className="font-mono font-semibold text-slate-700">123456</span>
          </p>
        </div>

        <Link
          to="/hr/login"
          className="mt-4 flex items-center gap-3 rounded-2xl border border-[#5D5FEF]/30 bg-white/50 backdrop-blur-lg p-4 shadow-lg shadow-[#5D5FEF]/10 transition-all hover:bg-white/70 hover:border-[#5D5FEF]/50 hover:shadow-[#5D5FEF]/20 group"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 text-white shadow-md shadow-[#5D5FEF]/25">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">HR Management Portal</p>
            <p className="text-xs text-slate-500 truncate">Employees, payroll, attendance &amp; more</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#5D5FEF] transition-transform group-hover:translate-x-0.5" />
        </Link>
      </motion.div>
    </div>
  );
}
