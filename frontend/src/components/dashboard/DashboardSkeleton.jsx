export default function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-32 rounded-2xl bg-surface-elevated" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-surface-elevated" />
        ))}
      </div>
      <div className="h-28 rounded-2xl bg-surface-elevated" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="h-80 rounded-2xl bg-surface-elevated xl:col-span-5" />
        <div className="h-80 rounded-2xl bg-surface-elevated xl:col-span-3" />
        <div className="h-80 rounded-2xl bg-surface-elevated xl:col-span-4" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-surface-elevated" />
        <div className="h-72 rounded-2xl bg-surface-elevated" />
        <div className="h-72 rounded-2xl bg-surface-elevated" />
      </div>
    </div>
  );
}
