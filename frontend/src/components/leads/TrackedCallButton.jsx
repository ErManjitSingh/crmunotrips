import { Phone } from 'lucide-react';
import { beginLeadCall } from '../../lib/callSession';
import { cn } from '../../lib/utils';

/**
 * Call button that starts duration tracking then opens the native dialer.
 */
export default function TrackedCallButton({
  lead,
  className,
  children,
  as: Comp = 'button',
  ...rest
}) {
  const phone = lead?.phone;
  const disabled = !phone;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!phone) return;
    beginLeadCall({
      leadId: lead._id,
      leadName: lead.name,
      phone,
    });
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
