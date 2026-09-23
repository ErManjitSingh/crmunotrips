import { getDayPartGreeting, getInitials } from '../../lib/coldCallingWorkspace';

/** Greeting + who is signed in. `identity` comes from getWorkspaceIdentity(authenticatedUser). */
export default function WelcomeHeader({ identity, now = new Date() }) {
  const greeting = getDayPartGreeting(now);
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600">Cold Calling Workspace</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">
          {identity.firstName ? `${greeting}, ${identity.firstName}` : greeting}
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Your calling workspace. Your Cold Calling activity will appear here once leads are assigned to you.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-subtle bg-white px-3 py-2 shadow-sm">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-xs font-bold text-white"
          aria-hidden="true"
        >
          {getInitials(identity.fullName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{identity.fullName}</span>
          <span className="block truncate text-xs text-slate-500">{identity.roleLabel}</span>
        </span>
      </div>
    </header>
  );
}
