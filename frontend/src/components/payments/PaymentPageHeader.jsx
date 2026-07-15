import { FileText, ChevronDown, Download } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export default function PaymentPageHeader({ onGenerateInvoice, onExport, onAddPayment }) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Payment Management
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-xl leading-relaxed">
            Manage invoices, collections, dues, refunds and complete finance operations from one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onGenerateInvoice}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Generate Invoice
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Export
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-[250] min-w-[160px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenu.Item
                  className="px-3 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-slate-50"
                  onSelect={() => onExport?.('excel')}
                >
                  Download Excel
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-slate-50"
                  onSelect={() => onExport?.('pdf')}
                >
                  Download PDF
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="px-3 py-2 rounded-lg text-sm cursor-pointer outline-none hover:bg-slate-50"
                  onSelect={() => window.print()}
                >
                  Print
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            onClick={onAddPayment}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-md shadow-violet-600/25 transition-colors lg:hidden"
          >
            + Add Payment
          </button>
        </div>
      </div>
    </div>
  );
}
