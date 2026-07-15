import LeadDetailHeader from './LeadDetailHeader';
import LeadStatusPipeline from './LeadStatusPipeline';
import LeadConvertedBanner from './LeadConvertedBanner';
import LeadPaymentVoucherPanel from './LeadPaymentVoucherPanel';
import LeadContactActions from '../whatsapp-contact/LeadContactActions';
import LeadCustomerPanel from './LeadCustomerPanel';
import LeadActivityTimeline from './LeadActivityTimeline';
import LeadActionPanel from './LeadActionPanel';
import LeadNotesPanel from './LeadNotesPanel';
import LeadUpcomingFollowUp from './LeadUpcomingFollowUp';
import LeadTagsPanel from './LeadTagsPanel';
import LeadQuotationSection from './LeadQuotationSection';
import LeadScoreBreakdown from './LeadScoreBreakdown';
import { useLeadQuotationsQuery, useLeadNotesQuery } from '../../features/leads/hooks/useLeadRelatedQueries';
import { getLeadDetailData } from './leadDetailData';

export default function LeadDetailLayout({
  lead,
  leadId,
  activities,
  timelineLoading,
  relatedBasePath = '/leads',
  backHref,
  backLabel,
  contactEndpoint,
  onCreateQuote,
  onScheduleFollowUp,
  onContactLogged,
  onEmailSent,
  onLogCallNote,
  onAssign,
  onChangeStatus,
  canCreateFollowUp,
  canEditLead,
  canChangeStatus,
  editHref,
  headerExtra,
  sidebarExtra,
  bottomExtra,
  receiptEndpoint,
}) {
  const detail = getLeadDetailData(lead);
  const followups = lead.followups || lead.followUps || detail.followUps || [];
  const embeddedQuotations = lead.quotations || detail.quotations || [];
  const embeddedNotes = detail.notes?.length ? detail.notes : null;

  const { data: quotationsData, isLoading: quotationsLoading } = useLeadQuotationsQuery(leadId, {
    basePath: relatedBasePath,
    enabled: !embeddedQuotations.length,
  });
  const { data: notesData, isLoading: notesLoading } = useLeadNotesQuery(leadId, {
    basePath: relatedBasePath,
    enabled: !embeddedNotes && !lead.notes,
  });

  const quotations = embeddedQuotations.length ? embeddedQuotations : (quotationsData?.items || []);
  const notes = embeddedNotes || notesData?.items || [];

  const paymentReceiptEndpoint =
    receiptEndpoint ||
    (relatedBasePath ? `${relatedBasePath}/${leadId}/payment-receipt` : `/leads/${leadId}/payment-receipt`);

  return (
    <>
      <LeadDetailHeader lead={lead} backHref={backHref} backLabel={backLabel} />
      {headerExtra}
      <LeadStatusPipeline status={lead.status} />
      <LeadConvertedBanner status={lead.status} />
      <LeadPaymentVoucherPanel
        lead={lead}
        paymentSummary={lead.paymentSummary}
        receiptEndpoint={paymentReceiptEndpoint}
      />

      <LeadContactActions
        lead={lead}
        leadId={leadId}
        contactEndpoint={contactEndpoint}
        onCreateQuote={onCreateQuote}
        onScheduleFollowUp={onScheduleFollowUp}
        onContactLogged={onContactLogged}
        onEmailSent={onEmailSent}
        onChangeStatus={onChangeStatus}
        onLogCallNote={onLogCallNote}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start mb-5">
        <aside className="xl:col-span-3 space-y-4 order-2 xl:order-1">
          <LeadCustomerPanel lead={lead} />
        </aside>

        <main className="xl:col-span-6 space-y-4 order-1 xl:order-2">
          <LeadActivityTimeline
            activities={activities}
            loading={timelineLoading}
            quotations={quotations}
          />
        </main>

        <aside className="xl:col-span-3 space-y-4 order-3">
          <LeadActionPanel
            onLogCallNote={onLogCallNote}
            onAssign={onAssign}
            onChangeStatus={onChangeStatus}
            canCreateFollowUp={canCreateFollowUp}
            canEditLead={canEditLead}
            canChangeStatus={canChangeStatus}
            editHref={editHref}
          />
          {sidebarExtra}
          <LeadNotesPanel notes={notes} legacyNote={lead.notes} loading={notesLoading} />
          <LeadUpcomingFollowUp followups={followups} lead={lead} />
          <LeadTagsPanel lead={lead} />
        </aside>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <LeadQuotationSection quotations={quotations} loading={quotationsLoading} />
        <LeadScoreBreakdown lead={lead} />
      </div>

      {bottomExtra}
    </>
  );
}
