import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dismissAnnouncement,
  fetchAnnouncementFeed,
  markAnnouncementPopupSeen,
  markAnnouncementRead,
} from '../../services/announcementApi';
import AnnouncementHero from './AnnouncementHero';
import AnnouncementCarousel from './AnnouncementCarousel';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';

const AnnouncementPopup = lazy(() => import('./AnnouncementPopup'));

const FEED_KEY = ['announcements', 'feed'];

export default function AnnouncementCenter() {
  const queryClient = useQueryClient();
  const [popupOpen, setPopupOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const { data } = useQuery({
    queryKey: FEED_KEY,
    queryFn: fetchAnnouncementFeed,
    staleTime: 120_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (data?.popup?._id && !data.popup.popupAlreadySeen) {
      setPopupOpen(true);
    }
  }, [data?.popup?._id, data?.popup?.popupAlreadySeen]);

  const patchFeed = useCallback(
    (updater) => {
      queryClient.setQueryData(FEED_KEY, (prev) => (prev ? updater(prev) : prev));
    },
    [queryClient]
  );

  const openDetail = useCallback(
    (item) => {
      setDetail(item);
      if (!item?._id || item.isRead) return;
      patchFeed((prev) => {
        const mark = (row) => (row && String(row._id) === String(item._id) ? { ...row, isRead: true } : row);
        return {
          ...prev,
          hero: mark(prev.hero),
          popup: mark(prev.popup),
          carousel: (prev.carousel || []).map(mark),
          unreadCount: Math.max(0, (prev.unreadCount || 1) - 1),
        };
      });
      markAnnouncementRead(item._id).catch(() => {});
    },
    [patchFeed]
  );

  const handleDismiss = useCallback(
    (item) => {
      if (!item?._id) return;
      patchFeed((prev) => {
        const id = String(item._id);
        const drop = (row) => (row && String(row._id) === id ? null : row);
        const nextCarousel = (prev.carousel || []).filter((row) => String(row._id) !== id);
        const nextHero = drop(prev.hero);
        return {
          ...prev,
          hero: nextHero || nextCarousel[0] || null,
          carousel: nextHero ? nextCarousel : nextCarousel.slice(1),
          popup: drop(prev.popup),
        };
      });
      dismissAnnouncement(item._id, 0).catch(() => {
        queryClient.invalidateQueries({ queryKey: FEED_KEY });
      });
    },
    [patchFeed, queryClient]
  );

  const handleParticipate = useCallback(
    (item) => {
      if (item.secondaryCtaUrl) window.open(item.secondaryCtaUrl, '_blank', 'noopener,noreferrer');
      else openDetail(item);
    },
    [openDetail]
  );

  const closePopup = useCallback(() => {
    setPopupOpen(false);
    const id = data?.popup?._id;
    if (!id) return;
    patchFeed((prev) => ({
      ...prev,
      popup: prev.popup ? { ...prev.popup, popupAlreadySeen: true } : null,
    }));
    markAnnouncementPopupSeen(id).catch(() => {});
  }, [data?.popup?._id, patchFeed]);

  if (!data) return null;
  const hasContent = data.hero || data.carousel?.length;
  if (!hasContent) return null;

  return (
    <>
      <div className="w-full space-y-2.5">
        <AnnouncementHero
          announcement={data.hero}
          onView={openDetail}
          onParticipate={handleParticipate}
          onDismiss={handleDismiss}
        />
        <AnnouncementCarousel items={data.carousel || []} onReadMore={openDetail} />
      </div>

      {popupOpen && (
        <Suspense fallback={null}>
          <AnnouncementPopup
            announcement={data.popup}
            open={popupOpen}
            onClose={closePopup}
            onView={(item) => {
              closePopup();
              openDetail(item);
            }}
          />
        </Suspense>
      )}

      <AppModal open={!!detail} onClose={() => setDetail(null)} size="lg" className="p-5 sm:p-6">
        {detail && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-content-primary">{detail.title}</h3>
            <p className="whitespace-pre-wrap text-sm text-content-secondary">{detail.description}</p>
            {detail.bodyHtml ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-subtle bg-surface-elevated/40 p-4"
                dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(detail.tags || []).map((tag) => (
                <span key={tag} className="rounded-full border border-subtle px-2.5 py-1 text-xs text-content-muted">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDetail(null)} className="w-full rounded-xl sm:w-auto">
                Close
              </Button>
              {detail.ctaUrl && (
                <Button
                  onClick={() => window.open(detail.ctaUrl, '_blank', 'noopener,noreferrer')}
                  className="w-full rounded-xl sm:w-auto"
                >
                  {detail.ctaText || 'Open'}
                </Button>
              )}
            </div>
          </div>
        )}
      </AppModal>
    </>
  );
}
