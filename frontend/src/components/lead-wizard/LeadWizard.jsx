import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { WizardFormContext } from './WizardFormContext';
import { ArrowLeft, Loader2 } from 'lucide-react';
import API from '../../api/axios';
import WizardStepProgress from './WizardStepProgress';
import WizardDraftIndicator from './WizardDraftIndicator';
import WizardFormBody from './WizardFormBody';
import { useLeadWizard } from './useLeadWizard';
import { DRAFT_STORAGE_KEY, defaultLeadSourceForRole, defaultWizardValues } from './constants';
import { leadToWizardValues, wizardValuesToPayload } from './leadWizardUtils';
import { useAuth } from '../../context/AuthContext';

function leadListPath(role) {
  if (role === 'sales_executive') return '/sales-executive/leads/all';
  if (role === 'sales_manager') return '/sales-manager/leads';
  if (role === 'team_leader') return '/team-leader/leads';
  return '/leads';
}

function leadDetailPath(role, leadId) {
  if (role === 'sales_executive') return `/sales-executive/leads/${leadId}/view`;
  if (role === 'sales_manager') return `/sales-manager/leads/${leadId}`;
  if (role === 'team_leader') return `/team-leader/leads/${leadId}/view`;
  return `/leads/${leadId}`;
}

function leadApiBase(role) {
  if (role === 'sales_executive') return '/sales-executive/leads';
  return '/leads';
}

export default function LeadWizard() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const draftKey = isEdit ? `${DRAFT_STORAGE_KEY}-edit-${id}` : DRAFT_STORAGE_KEY;
  const listPath = leadListPath(user?.role);
  const backPath = isEdit ? leadDetailPath(user?.role, id) : listPath;
  const apiBase = leadApiBase(user?.role);

  const [initialValues, setInitialValues] = useState(() => (
    isEdit
      ? null
      : {
          ...defaultWizardValues,
          leadSource: defaultLeadSourceForRole(user?.role),
        }
  ));
  const [loadingLead, setLoadingLead] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    API.get(`${apiBase}/${id}`)
      .then((res) => setInitialValues(leadToWizardValues(res.data)))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load lead'))
      .finally(() => setLoadingLead(false));
  }, [id, isEdit, apiBase]);

  const wizard = useLeadWizard({ initialValues, draftKey, isEdit });
  const {
    formApi, step, maxReachable, draftStatus, lastSaved,
    goNext, goBack, goToStep, clearDraft, setStep, getValues, reset,
  } = wizard;

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
        if (user?.role === 'sales_executive') {
          delete updatePayload.name;
          delete updatePayload.phone;
          delete updatePayload.email;
        }
        const res = await API.put(`${apiBase}/${id}`, updatePayload);
        saved = res.data;
      } else {
        const res = await API.post('/leads', payload);
        saved = res.data;
      }
      clearDraft();

      if (action === 'another') {
        reset({
          ...defaultWizardValues,
          leadSource: defaultLeadSourceForRole(user?.role),
        });
        setStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === 'open') {
        navigate(leadDetailPath(user?.role, saved._id));
      } else {
        navigate(isEdit ? leadDetailPath(user?.role, saved._id || id) : listPath);
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
        <Loader2 className="w-8 h-8 text-[#5D5FEF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <Link
            to={backPath}
            className="mt-0.5 p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-sm transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
              {isEdit ? 'Edit Lead' : 'Add Lead'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isEdit ? 'Update lead information' : 'Create a new lead in 2 simple steps.'}
            </p>
          </div>
        </div>
        {!isEdit && <WizardDraftIndicator status={draftStatus} lastSaved={lastSaved} />}
      </div>

      <div className="mb-5">
        <WizardStepProgress currentStep={step} maxReachable={maxReachable} onStepClick={goToStep} />
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">
          {error}
        </div>
      )}

      <WizardFormContext.Provider value={formApi}>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-0">
          <WizardFormBody
            step={step}
            isEdit={isEdit}
            leadId={id}
            saving={saving}
            onBack={goBack}
            onClear={() => {
              clearDraft();
              reset({
                ...defaultWizardValues,
                leadSource: defaultLeadSourceForRole(user?.role),
              });
            }}
            onNext={() => {
              goNext();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSave={saveLead}
          />
        </form>
      </WizardFormContext.Provider>
    </div>
  );
}
