import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dismissAnnouncement,
  fetchAnnouncementFeed,
  markAnnouncementPopupSeen,
  markAnnouncementRead,
} from '../../services/announcementApi';
import AnnouncementHero from './AnnouncementHero';
import AnnouncementCarousel from './AnnouncementCarousel';
import AnnouncementPopup from './AnnouncementPopup';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';

export default function AnnouncementCenter() {
  const queryClient = useQueryClient();
  const [popupOpen, setPopupOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const { data } = useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: fetchAnnouncementFeed,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.popup?._id && !data.popup.popupAlreadySeen) {
      setPopupOpen(true);
    }
  }, [data?.popup?._id, data?.popup?.popupAlreadySeen]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
  }, [queryClient]);

  const openDetail = async (item) => {
    setDetail(item);
    if (item?._id) {
      try {
        await markAnnouncementRead(item._id);
        refresh();
      } catch {
        /* ignore */
      }
    }
  };

  const handleDismiss = async (item) => {
    await dismissAnnouncement(item._id, 0);
    refresh();
  };

  const handleParticipate = (item) => {
    if (item.secondaryCtaUrl) window.open(item.secondaryCtaUrl, '_blank', 'noopener,noreferrer');
    else openDetail(item);
  };

  const closePopup = async () => {
    setPopupOpen(false);
    if (data?.popup?._id) {
      try {
        await markAnnouncementPopupSeen(data.popup._id);
        refresh();
      } catch {
        /* ignore */
      }
    }
  };

  if (!data) return null;
  const hasContent = data.hero || data.carousel?.length;
  if (!hasContent) return null;

  return (
    <>
      <div className="w-full space-y-3.5">
        <AnnouncementHero
          announcement={data.hero}
          onView={openDetail}
          onParticipate={handleParticipate}
          onDismiss={handleDismiss}
        />
        <AnnouncementCarousel items={data.carousel || []} onReadMore={openDetail} />
      </div>

      <AnnouncementPopup
        announcement={data.popup}
        open={popupOpen}
        onClose={closePopup}
        onView={(item) => {
          closePopup();
          openDetail(item);
        }}
      />

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
