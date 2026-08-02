import { useQueryClient } from '@tanstack/react-query';
import { usePostCallSession } from '../../hooks/usePostCallSession';
import { invalidateDashboard, invalidateLeadLists, invalidateNavCounts } from '../../lib/queryInvalidation';
import PostCallFollowUpModal from './PostCallFollowUpModal';

/** Global listener: after mobile tel: call ends & user returns, open follow-up popup */
export default function PostCallSessionHost() {
  const queryClient = useQueryClient();
  const { pendingCall, dismissPostCall, completePostCall } = usePostCallSession();

  return (
    <PostCallFollowUpModal
      open={Boolean(pendingCall)}
      session={pendingCall}
      onClose={dismissPostCall}
      onSaved={() => {
        completePostCall();
        invalidateLeadLists(queryClient);
        invalidateNavCounts(queryClient);
        invalidateDashboard(queryClient);
      }}
    />
  );
}
