import { cn } from '../../lib/utils';

export default function WhatsAppInboxLayout({
  listPanel,
  chatPanel,
  infoPanel,
  mobileView,
  className,
}) {
  return (
    <div
      className={cn(
        'wa-inbox flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
        className
      )}
    >
      <div
        className={cn(
          'w-full lg:w-[340px] xl:w-[360px] shrink-0 flex flex-col bg-white',
          mobileView !== 'list' && 'hidden lg:flex'
        )}
      >
        {listPanel}
      </div>

      <div
        className={cn(
          'flex-1 min-w-0 flex flex-col border-x border-slate-200/80',
          mobileView === 'info' && 'hidden lg:flex',
          mobileView === 'list' && 'hidden lg:flex',
          mobileView === 'chat' && 'flex'
        )}
      >
        {chatPanel}
      </div>

      <div
        className={cn(
          'w-full lg:w-[300px] xl:w-[340px] shrink-0 flex flex-col bg-white',
          mobileView === 'info' ? 'flex fixed inset-0 z-30 lg:relative lg:inset-auto' : 'hidden xl:flex',
          mobileView === 'list' && 'hidden xl:flex',
          mobileView === 'chat' && 'hidden xl:flex'
        )}
      >
        {infoPanel}
      </div>
    </div>
  );
}
