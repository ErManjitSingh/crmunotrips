import { cn } from '../../lib/utils';

function initials(name) {
  const letters = String(name || '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || '?';
}

/** Neutral violet initials — deliberately not one of the Cold/Warm/Hot hues, so colour keeps meaning status. */
export default function ExecutiveAvatar({ name, size = 'md', className }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 ring-1 ring-inset ring-violet-200',
        size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs',
        className
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
