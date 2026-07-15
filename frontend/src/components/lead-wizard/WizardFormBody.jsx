import { ArrowLeft, ArrowRight, Save, Plus, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { WIZARD_STEP_COUNT } from './constants';
import { useWizardForm } from './WizardFormContext';
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
}) {
  const { values } = useWizardForm();
  const isForm = step === 1;

  return (
    <>
      <div className="p-4 sm:p-5 min-h-[320px]">
        {isForm ? (
          <StepLeadForm isEdit={isEdit} leadId={leadId} />
        ) : (
          <StepReview data={values} />
        )}
      </div>

      <div className="px-4 sm:px-5 py-3.5 border-t border-subtle bg-gradient-to-r from-surface-elevated/50 via-brand-500/5 to-surface-elevated/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {step > 1 ? (
          <Button type="button" variant="outline" onClick={onBack} className="rounded-xl gap-2 order-2 sm:order-1 h-9 text-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to form
          </Button>
        ) : (
          <div className="hidden sm:block order-1" />
        )}

        {step < WIZARD_STEP_COUNT ? (
          <Button
            type="button"
            onClick={onNext}
            className="rounded-xl gap-2 sm:ml-auto order-1 sm:order-2 h-9 text-sm shadow-md shadow-brand-600/20"
          >
            Review lead <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto order-1 sm:order-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onSave('list')}
              className="rounded-xl gap-2 h-9 text-sm text-brand-700 border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Lead
            </Button>
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onSave('another')}
                className="rounded-xl gap-2 h-9 text-sm text-violet-700 border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20"
              >
                <Plus className="w-3.5 h-3.5" /> Save & Add Another
              </Button>
            )}
            <Button
              type="button"
              disabled={saving}
              onClick={() => onSave('open')}
              variant="emerald"
              className="rounded-xl gap-2 h-9 text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Save & Open Lead
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
