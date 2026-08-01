import API from '../api/axios';

/** Inbox path by role — all use the same company WhatsApp Cloud number. */
export function getCrmWhatsAppInboxPath(role) {
  if (role === 'sales_executive') return '/sales-executive/whatsapp';
  return '/whatsapp';
}

/**
 * Open CRM WhatsApp inbox for a lead (creates conversation if needed).
 * Replaces wa.me / personal WhatsApp for day-to-day lead chat.
 */
export async function openCrmWhatsApp({ leadId, phone, navigate, role, toast } = {}) {
  if (!leadId) {
    toast?.error?.('Lead id missing');
    return null;
  }
  if (!phone && phone !== 0) {
    // phone optional — backend reads from lead
  }

  try {
    const res = await API.post(
      '/whatsapp/open-chat',
      { leadId },
      { skipSuccessToast: true }
    );
    const row = res.data?.data || res.data;
    const conversationId = row?.conversationId || row?._id;
    if (!conversationId) {
      toast?.error?.('Could not open CRM WhatsApp chat');
      return null;
    }

    const base = getCrmWhatsAppInboxPath(role);
    const params = new URLSearchParams({
      conversationId: String(conversationId),
      leadId: String(row.leadId || leadId),
    });
    navigate?.(`${base}?${params.toString()}`);
    toast?.success?.('Opening CRM WhatsApp');
    return row;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'Could not open CRM WhatsApp';
    toast?.error?.(msg);
    return null;
  }
}
