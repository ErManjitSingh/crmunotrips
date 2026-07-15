import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';
import { buildWhatsAppUrl, openWhatsApp, renderWhatsAppTemplate } from '../../lib/whatsappContact';
import { fetchWhatsAppTemplates, logWhatsAppContact } from '../../services/whatsappTemplatesApi';
import { toast } from '../../context/ToastContext';

export default function WhatsAppActionButton({
  lead,
  leadId,
  contactEndpoint = '/leads',
  onContactLogged,
  className = '',
  size = 'default',
  showLabel = true,
  /** Controlled open state (optional) */
  open: controlledOpen,
  onOpenChange,
  /** Hide default button — use with controlled open from a parent tile */
  hideTrigger = false,
}) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canUseWhatsApp = can('whatsapp', 'use');
  const [internalOpen, setInternalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const pickerOpen = isControlled ? controlledOpen : internalOpen;
  const setPickerOpen = (next) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!pickerOpen || !canUseWhatsApp) return;
    setLoading(true);
    fetchWhatsAppTemplates()
      .then((rows) => setTemplates((rows || []).filter((t) => t.enabled !== false)))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [pickerOpen, canUseWhatsApp]);

  if (!canUseWhatsApp) return null;

  const phone = lead?.whatsapp || lead?.phone;
  const disabled = !phone;

  const launch = async (template = null) => {
    if (!leadId || !phone) {
      toast.error('Lead phone number is missing');
      return;
    }
    setSubmitting(true);
    try {
      const message = template
        ? renderWhatsAppTemplate(template.body, lead, user)
        : '';

      await logWhatsAppContact(leadId, { templateId: template?._id }, contactEndpoint);
      onContactLogged?.();

      const opened = openWhatsApp(phone, message);
      if (!opened) {
        toast.error('Could not open WhatsApp');
        return;
      }

      toast.success('Opening WhatsApp for the customer');
      setPickerOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const sizeClass = size === 'lg' ? 'h-11 px-5 text-sm' : 'h-10 px-4 text-sm';

  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          disabled={disabled || submitting}
          title="Open WhatsApp"
          onClick={() => setPickerOpen(true)}
          className={`rounded-xl gap-2 font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0 shadow-md shadow-green-600/25 ${sizeClass} ${className}`}
        >
          <MessageCircle className="w-4 h-4" />
          {showLabel && 'WhatsApp'}
        </Button>
      )}

      <AppModal open={pickerOpen} onClose={() => !submitting && setPickerOpen(false)} size="md" className="p-0 overflow-hidden">
        <div className="p-5 border-b border-subtle bg-gradient-to-r from-green-500/10 to-emerald-500/5">
          <h3 className="text-lg font-bold text-content-primary">Open WhatsApp</h3>
          <p className="text-sm text-content-muted mt-1">
            Choose a template or start without a message. Opens WhatsApp Web on desktop and the app on mobile.
          </p>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <button
            type="button"
            disabled={submitting}
            onClick={() => launch(null)}
            className="w-full text-left rounded-xl border border-subtle p-4 hover:border-green-500/40 hover:bg-green-500/5 transition-colors"
          >
            <p className="font-semibold text-content-primary">No template</p>
            <p className="text-xs text-content-muted mt-1">Open chat with {phone}</p>
          </button>

          {loading && <p className="text-sm text-content-muted text-center py-4">Loading templates…</p>}

          {!loading && templates.map((template) => (
            <button
              key={template._id}
              type="button"
              disabled={submitting}
              onClick={() => launch(template)}
              className="w-full text-left rounded-xl border border-subtle p-4 hover:border-green-500/40 hover:bg-green-500/5 transition-colors"
            >
              <p className="font-semibold text-content-primary">{template.name}</p>
              <p className="text-xs text-content-muted mt-2 whitespace-pre-line line-clamp-4">
                {renderWhatsAppTemplate(template.body, lead, user)}
              </p>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-subtle bg-surface-elevated/40 text-[11px] text-content-muted">
          Preview URL: {buildWhatsAppUrl(phone, '') || '—'}
        </div>
      </AppModal>
    </>
  );
}
