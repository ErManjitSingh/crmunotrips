import { useCallback, useEffect, useState } from 'react';
import {
  clearCallSession,
  getCallElapsedSeconds,
  peekCallSession,
} from '../lib/callSession';

/**
 * Detects return-to-app after a tel: dial and opens post-call follow-up.
 * Mobile browsers typically fire visibilitychange / pageshow when user comes back from Phone app.
 */
export function usePostCallSession() {
  const [pending, setPending] = useState(null);

  const consumeIfReady = useCallback(() => {
    const session = peekCallSession();
    if (!session?.leadId || !session?.startedAt) return;

    const elapsed = getCallElapsedSeconds(session);
    // Ignore accidental taps that never left / returned instantly
    if (elapsed < 3) return;

    setPending({
      ...session,
      durationSeconds: elapsed,
      endedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // Small delay so Phone app handoff settles
        window.setTimeout(consumeIfReady, 400);
      }
    };
    const onPageShow = (e) => {
      if (e.persisted || document.visibilityState === 'visible') {
        window.setTimeout(consumeIfReady, 400);
      }
    };
    const onFocus = () => window.setTimeout(consumeIfReady, 500);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);

    // Resume unfinished session after refresh
    const existing = peekCallSession();
    if (existing?.startedAt && getCallElapsedSeconds(existing) >= 3) {
      window.setTimeout(consumeIfReady, 600);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, [consumeIfReady]);

  const dismiss = useCallback(() => {
    clearCallSession();
    setPending(null);
  }, []);

  const complete = useCallback(() => {
    clearCallSession();
    setPending(null);
  }, []);

  return { pendingCall: pending, dismissPostCall: dismiss, completePostCall: complete };
}
