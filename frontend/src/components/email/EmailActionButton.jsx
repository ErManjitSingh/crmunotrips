import { useState } from 'react';
import { Mail } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../ui/button';
import EmailComposerModal from './EmailComposerModal';

export default function EmailActionButton({
  lead,
  leadId,
  emailEndpoint = '/leads',
  quotation = null,
  defaultCategory = 'custom',
  onEmailSent,
  size = 'default',
  showLabel = true,
  label = '📧 Send Email',
  className = '',
}) {
  const { can } = usePermissions();
  const canSendEmail = can('email', 'send');
  const [open, setOpen] = useState(false);

  if (!canSendEmail) return null;

  const sizeClass = size === 'lg' ? 'h-11 px-5 text-sm' : 'h-10 px-4 text-sm';

  return (
    <>
      <Button
        type="button"
        title={lead?.email ? 'Send Email' : 'Compose email (add address in composer)'}
        onClick={() => setOpen(true)}
        variant="default"
        className={`rounded-xl gap-2 font-semibold text-white border-0 bg-green-800 hover:bg-green-700 shadow-sm shadow-green-900/20 ${sizeClass} ${className}`}
      >
        <Mail className="w-4 h-4" />
        {showLabel ? label : null}
      </Button>

      <EmailComposerModal
        open={open}
        onClose={() => setOpen(false)}
        lead={lead}
        leadId={leadId}
        emailEndpoint={emailEndpoint}
        quotation={quotation}
        defaultCategory={defaultCategory}
        onSent={onEmailSent}
      />
    </>
  );
}
