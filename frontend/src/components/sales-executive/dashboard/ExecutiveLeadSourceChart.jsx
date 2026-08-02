import { Globe, MessageCircle, Users, MapPin, MoreHorizontal } from 'lucide-react';

const SOURCE_ICONS = {
  DPW: Globe,
  'DPW WA': MessageCircle,
  'DPW CALL': MapPin,
  DPW2: Users,
  'DPW2 WA': MessageCircle,
  'DPW2 CALL': MapPin,
  Referral: Users,
  'Call Lead': MapPin,
  Organic: Globe,
  Website: Globe,
  WhatsApp: MessageCircle,
};

function SourceIcon({ name }) {
  const Icon = SOURCE_ICONS[name] || MoreHorizontal;
  return <Icon className="w-4 h-4 text-content-muted shrink-0" />;
}

export default function ExecutiveLeadSourceChart({ data = [] }) {
  if (!data.length) {
    return <p className="text-sm text-content-muted py-12 text-center">No lead source data yet</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      {data.map((source) => {
        const pct = total ? Math.round((source.value / total) * 100) : 0;
        const width = Math.max((source.value / max) * 100, 4);

        return (
          <div key={source.name} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <SourceIcon name={source.name} />
                <span className="text-sm font-medium text-content-primary truncate">{source.name}</span>
              </div>
              <span className="text-sm font-semibold text-content-secondary tabular-nums shrink-0">{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${width}%`, background: source.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
