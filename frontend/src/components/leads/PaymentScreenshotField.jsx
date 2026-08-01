import { ImagePlus, X } from 'lucide-react';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 12;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error(`${file.name} must be under 8 MB`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        base64: String(reader.result || ''),
        name: file.name,
        previewUrl: String(reader.result || ''),
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Payment screenshot picker — supports multiple images.
 * value: [{ base64, name, previewUrl }]
 * existing: [{ url, name }] already saved on server
 */
export default function PaymentScreenshotField({
  value = [],
  existing = [],
  required = false,
  onChange,
  className = '',
  /** @deprecated single-file compat — prefer value/onChange with arrays */
  fileName = '',
  previewUrl = '',
  existingUrl = '',
  existingName = '',
}) {
  const files = Array.isArray(value) && value.length
    ? value
    : fileName || previewUrl
      ? [{ base64: '', name: fileName, previewUrl }]
      : [];

  const existingList = Array.isArray(existing) && existing.length
    ? existing
    : existingUrl
      ? [{ url: existingUrl, name: existingName || 'Payment proof' }]
      : [];

  const emit = (nextFiles, error = '') => {
    const first = nextFiles[0];
    onChange?.({
      files: nextFiles,
      base64: first?.base64 || '',
      name: first?.name || '',
      previewUrl: first?.previewUrl || '',
      error,
    });
  };

  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;

    const room = Math.max(0, MAX_FILES - files.length - existingList.length);
    if (!room) {
      emit(files, `You can upload up to ${MAX_FILES} screenshots`);
      return;
    }

    const slice = picked.slice(0, room);
    try {
      const loaded = await Promise.all(slice.map(readFileAsDataUrl));
      emit([...files, ...loaded], '');
    } catch (err) {
      emit(files, err.message || 'Upload failed');
    }
  };

  const removeAt = (index) => {
    emit(files.filter((_, i) => i !== index), '');
  };

  const clearAll = () => {
    emit([], '');
  };

  return (
    <div className={className}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Payment screenshot{required ? ' *' : ' (optional)'}
      </label>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Upload one or more UPI / bank transfer / card payment proof images
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">
          <ImagePlus className="h-3.5 w-3.5" />
          {files.length || existingList.length ? 'Add more images' : 'Upload screenshots'}
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
        </label>
        {files.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3 w-3" /> Clear new
          </button>
        )}
      </div>

      {(files.length > 0 || existingList.length > 0) && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {existingList.map((item) => {
            const isImage = /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(String(item.url || ''));
            return (
              <a
                key={`ex-${item.url}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group relative overflow-hidden rounded-xl border border-emerald-100 bg-white"
              >
                {isImage ? (
                  <img src={item.url} alt={item.name || 'Proof'} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center px-2 text-center text-[11px] font-semibold text-emerald-800">
                    {item.name || 'View file'}
                  </div>
                )}
                <span className="absolute bottom-0 inset-x-0 bg-black/55 px-1.5 py-1 text-[10px] text-white truncate">
                  {item.name || 'Saved'}
                </span>
              </a>
            );
          })}
          {files.map((item, index) => {
            const isImage = String(item.previewUrl || '').startsWith('data:image');
            return (
              <div
                key={`new-${item.name}-${index}`}
                className="group relative overflow-hidden rounded-xl border border-emerald-200 bg-white"
              >
                {isImage ? (
                  <img src={item.previewUrl} alt={item.name || 'Proof'} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center px-2 text-center text-[11px] font-semibold text-slate-700">
                    {item.name || 'File'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label={`Remove ${item.name || 'image'}`}
                >
                  <X className="h-3 w-3" />
                </button>
                <span className="absolute bottom-0 inset-x-0 bg-black/55 px-1.5 py-1 text-[10px] text-white truncate">
                  {item.name || `Image ${index + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
