import {
  Plus,
  FileText,
  Download,
  FileSpreadsheet,
  Printer,
  CalendarRange,
} from 'lucide-react';
import { DATE_PRESETS } from './constants';
import { cn } from '../../lib/utils';

export default function PaymentPageHeader({
  datePreset,
  onDatePresetChange,
  onAddPayment,
  onGenerateInvoice,
  onExport,
}) {
  return (
    <div className="mb-6 animate-fade-up">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-500 mb-2">
            Finance Operations
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-content-primary tracking-tight">
            Payment Management
          </h1>
          <p className="text-sm text-content-secondary mt-1.5 max-w-2xl">
            Manage invoices, collections, dues, refunds and complete finance operations from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={onAddPayment} className="btn-primary gap-1.5">
            <Plus className="w-4 h-4" />
            Add Payment
          </button>
          <button type="button" onClick={onGenerateInvoice} className="btn-secondary gap-1.5">
            <FileText className="w-4 h-4" />
            Generate Invoice
          </button>
          <button type="button" onClick={() => onExport?.('excel')} className="btn-ghost gap-1.5 border border-subtle">
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button type="button" onClick={() => onExport?.('pdf')} className="btn-ghost gap-1.5 border border-subtle">
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button type="button" onClick={() => window.print()} className="btn-ghost gap-1.5 border border-subtle">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-content-muted shrink-0">
          <CalendarRange className="w-3.5 h-3.5" />
          Date
        </span>
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onDatePresetChange(preset.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all',
              datePreset === preset.value
                ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/25'
                : 'bg-surface border border-subtle text-content-secondary hover:border-indigo-300 hover:text-indigo-600'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
