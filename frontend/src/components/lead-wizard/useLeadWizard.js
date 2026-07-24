import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DRAFT_STORAGE_KEY, defaultWizardValues, WIZARD_STEP_COUNT } from './constants';
import { formatDraftTime } from './leadWizardUtils';

function mergeValues(partial) {
  return { ...defaultWizardValues, ...partial };
}

function readFieldValue(values, name) {
  const v = values[name];
  if (v !== undefined && v !== null && v !== '') return v;
  const fallback = defaultWizardValues[name];
  return fallback !== undefined ? fallback : '';
}

export function useLeadWizard({ initialValues, draftKey = DRAFT_STORAGE_KEY, isEdit }) {
  const [values, setValues] = useState(() => mergeValues(initialValues));
  const [step, setStep] = useState(1);
  const [maxReachable, setMaxReachable] = useState(1);
  const [draftStatus, setDraftStatus] = useState('idle');
  const [lastSaved, setLastSaved] = useState('');
  const [errors, setErrors] = useState({});
  const draftTimer = useRef(null);
  const hydrated = useRef(false);

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const reset = useCallback((next) => {
    setValues(mergeValues(next));
  }, []);

  const register = useCallback(
    (name) => ({
      name,
      value: readFieldValue(values, name),
      onChange: (e) => {
        const { type, value } = e.target;
        let next = value;
        if (type === 'number') {
          next = value === '' ? '' : Number(value);
          if (Number.isNaN(next)) next = '';
        }
        setValues((prev) => ({ ...prev, [name]: next }));
      },
    }),
    [values]
  );

  const watch = useCallback(
    (name) => (name ? values[name] : values),
    [values]
  );

  const getValues = useCallback(() => ({ ...values }), [values]);

  useEffect(() => {
    if (initialValues) reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    if (isEdit || hydrated.current) return;
    hydrated.current = true;
    const stored = localStorage.getItem(draftKey);
    if (stored && !initialValues) {
      try {
        const { values: saved, step: savedStep } = JSON.parse(stored);
        if (saved?.name?.trim() || saved?.phone?.trim()) {
          reset(saved);
          const safeStep = Math.min(Math.max(savedStep || 1, 1), WIZARD_STEP_COUNT);
          setStep(safeStep);
          setMaxReachable(safeStep);
        }
      } catch {
        /* ignore */
      }
    }
  }, [draftKey, isEdit, initialValues, reset]);

  useEffect(() => {
    if (isEdit) return;
    setDraftStatus('saving');
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (!values.name?.trim() && !values.phone?.trim()) return;
      localStorage.setItem(draftKey, JSON.stringify({ values, step, savedAt: Date.now() }));
      setDraftStatus('saved');
      setLastSaved(formatDraftTime());
      setTimeout(() => setDraftStatus('idle'), 2500);
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [values, step, draftKey, isEdit]);

  const validateStep = useCallback((currentStep = step) => {
    const nextErrors = {};
    if (currentStep === 1) {
      if (!values.name?.trim()) nextErrors.name = { message: 'Customer name is required' };
      if (!values.phone?.trim()) nextErrors.phone = { message: 'Phone is required' };
      if (!values.leadSource) nextErrors.leadSource = { message: 'Select a source' };
      if (!values.priority) nextErrors.priority = { message: 'Select intent' };
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [step, values]);

  const goNext = useCallback(() => {
    if (!validateStep(step)) return false;
    const next = Math.min(step + 1, WIZARD_STEP_COUNT);
    setStep(next);
    setMaxReachable((m) => Math.max(m, next));
    return true;
  }, [step, validateStep]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const goToStep = useCallback((target) => {
    const safe = Math.min(Math.max(target, 1), WIZARD_STEP_COUNT);
    setStep(safe);
    setMaxReachable((m) => Math.max(m, safe));
    return true;
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(draftKey);
  }, [draftKey]);

  const formApi = useMemo(
    () => ({
      values,
      register,
      setValue,
      watch,
      getValues,
      reset,
      formState: { errors },
      validateStep,
    }),
    [values, register, setValue, watch, getValues, reset, validateStep, errors]
  );

  return {
    formApi,
    values,
    step,
    maxReachable,
    draftStatus,
    lastSaved,
    goNext,
    goBack,
    goToStep,
    setStep,
    validateStep,
    errors,
    clearDraft,
    getValues,
    reset,
  };
}
