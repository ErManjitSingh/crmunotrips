import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../ui/button';
import { openCrmWhatsApp } from '../../lib/openCrmWhatsApp';
import { toast } from '../../context/ToastContext';

/** Opens company CRM WhatsApp inbox for this lead. */
export default function WhatsAppActionButton({
  lead,
  leadId,
  onContactLogged,
  className = '',
  size = 'default',
  showLabel = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canUseWhatsApp = can('whatsapp', 'use');
  const [submitting, setSubmitting] = useState(false);

  if (!canUseWhatsApp) return null;

  const id = leadId || lead?._id;
  const phone = lead?.whatsapp || lead?.phone;
  const disabled = !phone || !id;
  const sizeClass = size === 'lg' ? 'h-11 px-5 text-sm' : 'h-10 px-4 text-sm';

  const launch = async () => {
    if (!id || !phone) {
      toast.error('Lead phone number is missing');
      return;
    }
    setSubmitting(true);
    try {
      const row = await openCrmWhatsApp({
        leadId: id,
        phone,
        navigate,
        role: user?.role,
        toast,
      });
      if (row) onContactLogged?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type="button"
      disabled={disabled || submitting}
      title="Open CRM WhatsApp"
      onClick={launch}
      className={`rounded-xl gap-2 font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0 shadow-md shadow-green-600/25 ${sizeClass} ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      {showLabel && (submitting ? 'Opening…' : 'WhatsApp')}
    </Button>
  );
}
