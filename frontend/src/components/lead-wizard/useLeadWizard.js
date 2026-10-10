import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DRAFT_STORAGE_KEY, defaultWizardValues } from './constants';
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
    if (!stored) return;
    try {
      const { values: saved } = JSON.parse(stored);
      if (saved?.name?.trim() || saved?.phone?.trim() || saved?.pickupPoint?.trim() || saved?.dropPoint?.trim()) {
        reset(saved);
      }
    } catch {
      /* ignore */
    }
  }, [draftKey, isEdit, reset]);

  useEffect(() => {
    if (isEdit) return;
    setDraftStatus('saving');
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      if (!values.name?.trim() && !values.phone?.trim()) return;
      localStorage.setItem(draftKey, JSON.stringify({ values, savedAt: Date.now() }));
      setDraftStatus('saved');
      setLastSaved(formatDraftTime());
      setTimeout(() => setDraftStatus('idle'), 2500);
    }, 800);
    return () => clearTimeout(draftTimer.current);
  }, [values, draftKey, isEdit]);

  /** Same checks the old per-step gate ran before advancing to Review — now run once, at save time. */
  const validate = useCallback(() => {
    const nextErrors = {};
    if (!values.name?.trim()) nextErrors.name = { message: 'Customer name is required' };
    if (!values.phone?.trim()) nextErrors.phone = { message: 'Phone is required' };
    if (!values.subCity?.trim()) nextErrors.subCity = { message: 'Sub city is required' };
    if (!values.foodPreference) nextErrors.foodPreference = { message: 'Select Veg or Non-Veg' };
    if (!values.leadSource) nextErrors.leadSource = { message: 'Select a source' };
    if (!values.priority) nextErrors.priority = { message: 'Select intent' };
    if (values.leadSource === 'referral') {
      if (!values.referrerName?.trim()) nextErrors.referrerName = { message: 'Referrer name is required' };
      if (!values.referrerPhone?.trim()) nextErrors.referrerPhone = { message: 'Referrer mobile number is required' };
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [values]);

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
      validate,
    }),
    [values, register, setValue, watch, getValues, reset, validate, errors]
  );

  return {
    formApi,
    values,
    draftStatus,
    lastSaved,
    validate,
    errors,
    clearDraft,
    getValues,
    reset,
  };
}
