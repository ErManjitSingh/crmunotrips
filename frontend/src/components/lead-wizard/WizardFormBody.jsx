import { ArrowLeft, ArrowRight, Save, Plus, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { WIZARD_STEP_COUNT, defaultLeadSourceForRole, defaultWizardValues } from './constants';
import { useWizardForm } from './WizardFormContext';
import { useAuth } from '../../context/AuthContext';
import StepLeadForm from './steps/StepLeadForm';
import StepReview from './steps/StepReview';

export default function WizardFormBody({
  step,
  isEdit,
  leadId,
  saving,
  onBack,
  onNext,
  onSave,
  onClear,
}) {
  const { values, reset } = useWizardForm();
  const { user } = useAuth();
  const isForm = step === 1;

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    reset({
      ...defaultWizardValues,
      leadSource: defaultLeadSourceForRole(user?.role),
    });
  };

  return (
    <>
      <div className="min-h-[320px]">
        {isForm ? (
          <StepLeadForm isEdit={isEdit} leadId={leadId} />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6">
            <StepReview data={values} />
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-sm px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {isForm ? (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors order-2 sm:order-1"
          >
            <Trash2 className="w-4 h-4" />
            Clear Form
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="rounded-xl gap-2 order-2 sm:order-1 h-11 text-sm border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" /> Back to form
          </Button>
        )}

        {step < WIZARD_STEP_COUNT ? (
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto order-1 sm:order-2 w-full sm:w-auto">
            {!isEdit && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
            )}
            <Button
              type="button"
              onClick={onNext}
              className="rounded-xl gap-2 h-11 text-sm bg-[#5D5FEF] hover:bg-[#4F51E0] shadow-lg shadow-[#5D5FEF]/25 px-6"
            >
              Save & Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto order-1 sm:order-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onSave('list')}
              className="rounded-xl gap-2 h-11 text-sm border-slate-200"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Lead
            </Button>
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onSave('another')}
                className="rounded-xl gap-2 h-11 text-sm border-[#5D5FEF]/30 text-[#5D5FEF] bg-[#5D5FEF]/5 hover:bg-[#5D5FEF]/10"
              >
                <Plus className="w-4 h-4" /> Save & Add Another
              </Button>
            )}
            <Button
              type="button"
              disabled={saving}
              onClick={() => onSave('open')}
              className="rounded-xl gap-2 h-11 text-sm bg-[#5D5FEF] hover:bg-[#4F51E0] shadow-lg shadow-[#5D5FEF]/25"
            >
              <ExternalLink className="w-4 h-4" /> Save & Open Lead
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
