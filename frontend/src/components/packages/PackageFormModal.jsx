import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';
import { defaultItineraryDay } from '../quotations/quotationUtils';
import ItineraryBuilder from './ItineraryBuilder';
import InclusionExclusionEditor, { cleanInclusionExclusionLines } from '../quotations/InclusionExclusionEditor';

const empty = {
  name: '',
  destination: '',
  duration: 5,
  startingPrice: '',
  packageType: 'domestic',
  itinerary: [],
  inclusions: [''],
  exclusions: [''],
};

export default function PackageFormModal({ open, onClose, onSubmit, editPackage, isClone }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editPackage) {
      setForm({
        ...editPackage,
        startingPrice: editPackage.startingPrice || '',
        inclusions: editPackage.inclusions?.length ? [...editPackage.inclusions] : [''],
        exclusions: editPackage.exclusions?.length ? [...editPackage.exclusions] : [''],
        itinerary: editPackage.itinerary?.length
          ? editPackage.itinerary.map((d) => ({ ...d }))
          : [defaultItineraryDay(1, editPackage.destination || '')],
      });
    } else {
      setForm({
        ...empty,
        itinerary: [
          defaultItineraryDay(1, ''),
          defaultItineraryDay(2, ''),
          defaultItineraryDay(3, ''),
          defaultItineraryDay(4, ''),
        ],
      });
    }
  }, [editPackage, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      startingPrice: Number(form.startingPrice),
      duration: form.itinerary.length || Number(form.duration),
      inclusions: cleanInclusionExclusionLines(form.inclusions),
      exclusions: cleanInclusionExclusionLines(form.exclusions),
    });
  };

  return (
    <AppModal open={open} onClose={onClose} size="2xl" className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-content-primary">Edit package copy</h3>
          {isClone && (
            <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1 mt-2 inline-block">
              This is your private copy — Uno catalog original stays unchanged
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-surface-elevated">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Package Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-premium w-full h-11 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Destination *</label>
            <input
              required
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              className="input-premium w-full h-11 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Starting Price (₹) *</label>
            <input
              required
              type="number"
              min={0}
              value={form.startingPrice}
              onChange={(e) => setForm({ ...form, startingPrice: e.target.value })}
              className="input-premium w-full h-11 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Tour Type</label>
            <select
              value={form.packageType}
              onChange={(e) => setForm({ ...form, packageType: e.target.value })}
              className="input-premium w-full h-11 rounded-xl"
            >
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
            </select>
          </div>
        </div>

        <ItineraryBuilder
          itinerary={form.itinerary}
          onChange={(itinerary) => setForm({ ...form, itinerary, duration: itinerary.length })}
          destination={form.destination}
        />

        <div className="rounded-2xl border border-subtle bg-surface-base p-4">
          <InclusionExclusionEditor
            mode="inclusions"
            inclusions={form.inclusions}
            exclusions={form.exclusions}
            onChangeInclusions={(inclusions) => setForm({ ...form, inclusions })}
            onChangeExclusions={(exclusions) => setForm({ ...form, exclusions })}
          />
        </div>

        <div className="rounded-2xl border border-subtle bg-surface-base p-4">
          <InclusionExclusionEditor
            mode="exclusions"
            inclusions={form.inclusions}
            exclusions={form.exclusions}
            onChangeInclusions={(inclusions) => setForm({ ...form, inclusions })}
            onChangeExclusions={(exclusions) => setForm({ ...form, exclusions })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="amber" className="flex-1 rounded-xl">
            Save copy
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
