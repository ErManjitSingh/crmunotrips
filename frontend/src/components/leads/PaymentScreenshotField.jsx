import { ImagePlus, X } from 'lucide-react';

/**
 * Payment screenshot picker for lead conversion / commercial form.
 */
export default function PaymentScreenshotField({
  fileName = '',
  previewUrl = '',
  existingUrl = '',
  existingName = '',
  required = false,
  onChange,
  className = '',
}) {
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      e.target.value = '';
      onChange?.({ error: 'Screenshot must be under 8 MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange?.({
        base64: String(reader.result || ''),
        name: file.name,
        previewUrl: String(reader.result || ''),
        error: '',
      });
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    onChange?.({ base64: '', name: '', previewUrl: '', error: '' });
  };

  const showPreview = previewUrl || existingUrl;

  return (
    <div className={className}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Payment screenshot {required ? '*' : '(optional)'}
      </label>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Upload UPI / bank transfer / card payment proof image
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
          <ImagePlus className="h-3.5 w-3.5" />
          {fileName || existingName ? 'Change image' : 'Upload screenshot'}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFile}
          />
        </label>
        {(fileName || previewUrl) && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      {(fileName || existingName) && (
        <p className="mt-1.5 text-xs text-slate-600">
          {fileName || existingName}
          {existingUrl && !previewUrl ? ' (already uploaded)' : ''}
        </p>
      )}
      {(showPreview && (String(showPreview).startsWith('data:image') || /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(String(showPreview)))) ? (
        <a
          href={previewUrl || existingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block overflow-hidden rounded-xl border border-emerald-100 bg-white"
        >
          <img
            src={previewUrl || existingUrl}
            alt="Payment screenshot"
            className="max-h-40 w-full object-contain"
          />
        </a>
      ) : null}
    </div>
  );
}
