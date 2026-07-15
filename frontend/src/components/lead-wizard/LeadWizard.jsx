import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { WizardFormContext } from './WizardFormContext';
import { ArrowLeft, Loader2 } from 'lucide-react';
import API from '../../api/axios';
import WizardStepProgress from './WizardStepProgress';
import WizardDraftIndicator from './WizardDraftIndicator';
import WizardFormBody from './WizardFormBody';
import { useLeadWizard } from './useLeadWizard';
import { DRAFT_STORAGE_KEY } from './constants';
import { leadToWizardValues, wizardValuesToPayload } from './leadWizardUtils';

export default function LeadWizard() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const draftKey = isEdit ? `${DRAFT_STORAGE_KEY}-edit-${id}` : DRAFT_STORAGE_KEY;

  const [initialValues, setInitialValues] = useState(null);
  const [loadingLead, setLoadingLead] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    API.get(`/leads/${id}`)
      .then((res) => setInitialValues(leadToWizardValues(res.data)))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load lead'))
      .finally(() => setLoadingLead(false));
  }, [id, isEdit]);

  const wizard = useLeadWizard({ initialValues, draftKey, isEdit });
  const { formApi, step, maxReachable, draftStatus, lastSaved, goNext, goBack, goToStep, clearDraft, setStep, getValues, reset } = wizard;

  const saveLead = async (action = 'list') => {
    setSaving(true);
    setError('');
    const values = getValues();
    const budgetValue = values.budgetRange === 'custom' ? Number(values.customBudget) : Number(values.budget);
    if (!(budgetValue > 0)) {
      setError('Budget is required before creating lead');
      setSaving(false);
      return;
    }
    const payload = wizardValuesToPayload(values);

    try {
      let saved;
      if (isEdit) {
        const { status, ...updatePayload } = payload;
        const res = await API.put(`/leads/${id}`, updatePayload);
        saved = res.data;
      } else {
        const res = await API.post('/leads', payload);
        saved = res.data;
      }
      clearDraft();

      if (action === 'another') {
        reset();
        setStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'open') {
        navigate(`/leads/${saved._id}`);
      } else {
        navigate('/leads');
      }
    } catch (err) {
      const apiMsg = err.response?.data?.message;
      setError(apiMsg || err.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  if (loadingLead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5">
          <Link
            to="/leads"
            className="mt-0.5 p-2 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-content-primary tracking-tight">
              {isEdit ? 'Edit Lead' : 'Add Lead'}
            </h1>
            <p className="text-xs sm:text-sm text-content-muted mt-0.5">
              {isEdit ? 'Update lead information' : '2 steps — form, then review'}
            </p>
          </div>
        </div>
        {!isEdit && <WizardDraftIndicator status={draftStatus} lastSaved={lastSaved} />}
      </div>

      <div className="mb-4">
        <WizardStepProgress currentStep={step} maxReachable={maxReachable} onStepClick={goToStep} />
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-sm">
          {error}
        </div>
      )}

      <WizardFormContext.Provider value={formApi}>
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="rounded-2xl border border-subtle bg-surface/95 backdrop-blur-sm shadow-xl shadow-brand-900/5 overflow-hidden ring-1 ring-brand-500/5">
            <WizardFormBody
              step={step}
              isEdit={isEdit}
              leadId={id}
              saving={saving}
              onBack={goBack}
              onNext={() => {
                goNext();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSave={saveLead}
            />
          </div>
        </form>
      </WizardFormContext.Provider>
    </div>
  );
}
