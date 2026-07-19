import API from '../api/axios';

export async function sendQuotationWhatsApp(
  leadId,
  { quotationId, phone, saveAsAlternate = false } = {},
  endpointPrefix = '/leads'
) {
  const { data } = await API.post(
    `${endpointPrefix}/${leadId}/send-quotation-whatsapp`,
    {
      quotationId,
      phone,
      saveAsAlternate: Boolean(saveAsAlternate),
    },
    { skipSuccessToast: true }
  );
  return data;
}
