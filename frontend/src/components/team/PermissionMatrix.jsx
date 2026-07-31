import { Check, X } from 'lucide-react';
import Switch from '../ui/switch';
import { PERMISSION_MODULES } from './constants';

const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

function Toggle({ checked, onChange, disabled }) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      size="md"
      tone="brand"
      aria-label={checked ? 'Disable permission' : 'Enable permission'}
      onCheckedChange={(next) => onChange?.(next)}
    />
  );
}

export default function PermissionMatrix({ permissions, onChange, readOnly = false }) {
  return (
    <div className="rounded-2xl border border-subtle overflow-hidden bg-surface/80">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-brand-600/[0.06] to-violet-500/[0.04] border-b border-subtle">
              <th className="text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                Permission
              </th>
              {ALL_ACTIONS.map((action) => (
                <th
                  key={action}
                  className="px-3 py-3.5 text-[11px] font-bold uppercase tracking-wider text-content-muted text-center"
                >
                  <span className="capitalize block">{action}</span>
                  {!readOnly && <span className="text-[9px] font-normal normal-case text-content-muted/80">Allow</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle/80">
            {Object.entries(PERMISSION_MODULES).map(([mod, cfg]) => (
              <tr key={mod} className="hover:bg-brand-500/[0.03] transition-colors">
                <td className="px-4 py-3.5 font-semibold text-content-primary whitespace-nowrap">{cfg.label}</td>
                {ALL_ACTIONS.map((action) => {
                  const available = cfg.actions.includes(action);
                  const checked = permissions?.[mod]?.[action] ?? false;
                  if (!available) {
                    return (
                      <td key={action} className="px-3 py-3.5 text-center">
                        <span className="text-content-muted/25 text-lg">·</span>
                      </td>
                    );
                  }
                  if (readOnly) {
                    return (
                      <td key={action} className="px-3 py-3.5 text-center">
                        {checked ? (
                          <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-content-muted/35 mx-auto" />
                        )}
                      </td>
                    );
                  }
                  return (
                    <td key={action} className="px-3 py-3.5 text-center">
                      <Toggle
                        checked={checked}
                        onChange={(val) => onChange?.(mod, action, val)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
