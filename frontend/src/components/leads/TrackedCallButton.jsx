import { useRef } from 'react';
import { Phone } from 'lucide-react';
import { beginLeadCall } from '../../lib/callSession';
import { cn } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';

/**
 * Call button that starts duration tracking then opens the native dialer.
 *
 * `coldCalling` routes the pre-dial authorization through the Cold Calling endpoint (which requires an
 * active assignment for the signed-in agent). Everything else — the dialer, the timer, the post-call
 * form — is the same mechanism Sales Executives use.
 */
export default function TrackedCallButton({
  lead,
  className,
  children,
  as: Comp = 'button',
  coldCalling = false,
  ...rest
}) {
  const toast = useToast();
  const startingRef = useRef(false);
  const phone = lead?.phone;
  const disabled = !phone;

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!phone) return;
    // A double click / repeated tap must not start two calls (two dial attempts, two sessions).
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const session = await beginLeadCall({
        leadId: lead._id,
        leadName: lead.name,
        phone,
        coldCalling,
      });
      if (coldCalling && !session) toast.error('Could not start the call. Please try again.');
    } finally {
      startingRef.current = false;
    }
  };

  const shared = {
    type: Comp === 'button' ? 'button' : undefined,
    href: Comp === 'a' ? (phone ? `tel:${phone}` : undefined) : undefined,
    onClick: handleClick,
    className: cn(className, disabled && 'pointer-events-none opacity-40'),
    ...rest,
  };

  return (
    <Comp {...shared}>
      {children || (
        <>
          <Phone className="h-3.5 w-3.5" />
          Call
        </>
      )}
    </Comp>
  );
}
