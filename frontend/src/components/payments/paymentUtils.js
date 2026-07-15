import { MONTHLY_TARGET, METHOD_MAP, STATUS_MAP } from './constants';

export function formatINR(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function formatINRCompact(amount) {
  const n = Number(amount) || 0;
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)} Lakh`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return formatINR(n);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';
}

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
];

export function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function pendingAmount(payment) {
  const amount = Number(payment?.amount) || 0;
  const paid = Number(payment?.paidAmount) || 0;
  return Math.max(0, amount - paid);
}

export function totalRefunded(payment) {
  return (payment?.refunds || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

export function getStatusMeta(status) {
  return STATUS_MAP[status] || STATUS_MAP.pending;
}

export function getMethodMeta(method) {
  return METHOD_MAP[method] || { value: method, label: method || '—', color: '#64748B' };
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getDateRange(preset, custom = {}) {
  const now = new Date();
  const today = startOfDay(now);
  if (preset === 'today') return { from: today, to: now };
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: y, to: today };
  }
  if (preset === 'week') {
    const from = new Date(today);
    from.setDate(from.getDate() - from.getDay());
    return { from, to: now };
  }
  if (preset === 'month') {
    return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: now };
  }
  if (preset === 'quarter') {
    const q = Math.floor(today.getMonth() / 3) * 3;
    return { from: new Date(today.getFullYear(), q, 1), to: now };
  }
  if (preset === 'custom') {
    return {
      from: custom.dateFrom ? startOfDay(custom.dateFrom) : null,
      to: custom.dateTo ? new Date(custom.dateTo) : null,
    };
  }
  return { from: null, to: null };
}

export function filterPayments(payments, filters, datePreset) {
  const { from, to } = getDateRange(datePreset, filters);
  const q = filters.search?.trim().toLowerCase() || '';

  return payments.filter((p) => {
    if (filters.status && p.status !== filters.status) return false;
    if (filters.method && p.method !== filters.method) return false;
    if (filters.destination) {
      const dest = p.lead?.destination || '';
      if (!dest.toLowerCase().includes(filters.destination.toLowerCase())) return false;
    }
    if (filters.amountMin && Number(p.amount) < Number(filters.amountMin)) return false;
    if (filters.amountMax && Number(p.amount) > Number(filters.amountMax)) return false;

    const ref = new Date(p.paidAt || p.createdAt);
    if (from && ref < from) return false;
    if (to && ref > to) return false;

    if (!q) return true;
    const hay = [
      p.invoiceNumber,
      p.customerName,
      p.lead?.name,
      p.lead?.phone,
      p.lead?.email,
      p.lead?.destination,
      p.booking?.bookingNumber,
      p.quotation?.quoteNumber,
      p.method,
      p.status,
      p.createdBy?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

function spark(seed, base = 40) {
  return Array.from({ length: 8 }, (_, i) => Math.max(8, Math.round(base + Math.sin(seed + i) * 18 + (i % 3) * 6)));
}

const PAYMENT_STATUS_KEYS = ['paid', 'pending', 'partial', 'refunded', 'cancelled', 'failed'];

export function buildPaymentAnalytics(payments) {
  const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const received = payments.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
  const pending = payments.reduce((s, p) => s + pendingAmount(p), 0);
  const refunded = payments.reduce((s, p) => s + totalRefunded(p), 0);
  const advances = payments
    .filter((p) => p.status === 'partial' || (Number(p.paidAmount) > 0 && Number(p.paidAmount) < Number(p.amount)))
    .reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);

  const todayStart = startOfDay(new Date());
  const todayCollection = payments
    .filter((p) => p.paidAt && new Date(p.paidAt) >= todayStart)
    .reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);

  const successEligible = payments.filter((p) => p.status !== 'cancelled');
  const successCount = successEligible.filter((p) => ['paid', 'partial'].includes(p.status)).length;
  const successRate = successEligible.length
    ? Math.round((successCount / successEligible.length) * 1000) / 10
    : 0;

  const byStatus = {};
  PAYMENT_STATUS_KEYS.forEach((k) => {
    byStatus[k] = 0;
  });
  payments.forEach((p) => {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  });

  const byMethod = {};
  payments.forEach((p) => {
    const key = p.method || 'bank_transfer';
    byMethod[key] = (byMethod[key] || 0) + (Number(p.paidAmount) || 0);
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap = {};
  payments.forEach((p) => {
    const d = new Date(p.paidAt || p.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!monthlyMap[key]) monthlyMap[key] = { label: monthNames[d.getMonth()], revenue: 0, collected: 0 };
    monthlyMap[key].revenue += Number(p.amount) || 0;
    monthlyMap[key].collected += Number(p.paidAmount) || 0;
  });
  const monthlyTrend = Object.values(monthlyMap).slice(-6);

  const destMap = {};
  payments.forEach((p) => {
    const dest = p.lead?.destination || 'Other';
    destMap[dest] = (destMap[dest] || 0) + (Number(p.paidAmount) || 0);
  });
  const destinationRevenue = Object.entries(destMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const execMap = {};
  payments.forEach((p) => {
    const name = p.createdBy?.name || 'Unassigned';
    execMap[name] = (execMap[name] || 0) + (Number(p.paidAmount) || 0);
  });
  const executiveRevenue = Object.entries(execMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const collected = received;
  const remaining = Math.max(0, MONTHLY_TARGET - collected);
  const targetPct = Math.min(100, Math.round((collected / MONTHLY_TARGET) * 100));

  const overdue = payments.filter((p) => {
    if (!p.dueDate || ['paid', 'refunded', 'cancelled'].includes(p.status)) return false;
    return new Date(p.dueDate) < todayStart;
  });
  const dueToday = payments.filter((p) => {
    if (!p.dueDate || ['paid', 'refunded', 'cancelled'].includes(p.status)) return false;
    const d = startOfDay(p.dueDate);
    return d.getTime() === todayStart.getTime();
  });
  const upcoming = payments
    .filter((p) => {
      if (!p.dueDate || ['paid', 'refunded', 'cancelled'].includes(p.status)) return false;
      return new Date(p.dueDate) > todayStart;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const recent = [...payments]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 6);

  const refundRequests = payments.filter((p) => (p.refunds || []).length > 0 || p.status === 'refunded').slice(0, 5);

  return {
    kpis: [
      {
        key: 'revenue',
        label: 'Total Revenue',
        value: formatINRCompact(totalRevenue),
        change: '+12.4%',
        changeType: 'up',
        iconColor: 'bg-indigo-500',
        sparkColor: '#5B5CEB',
        sparkData: spark(1, 55),
      },
      {
        key: 'received',
        label: 'Received Amount',
        value: formatINRCompact(received),
        change: '+8.2%',
        changeType: 'up',
        iconColor: 'bg-emerald-500',
        sparkColor: '#16C784',
        sparkData: spark(2, 48),
      },
      {
        key: 'pending',
        label: 'Pending Collection',
        value: formatINRCompact(pending),
        change: '-3.1%',
        changeType: 'down',
        iconColor: 'bg-amber-500',
        sparkColor: '#F59E0B',
        sparkData: spark(3, 35),
      },
      {
        key: 'advance',
        label: 'Advance Received',
        value: formatINRCompact(advances),
        change: '+5.6%',
        changeType: 'up',
        iconColor: 'bg-sky-500',
        sparkColor: '#0EA5E9',
        sparkData: spark(4, 42),
      },
      {
        key: 'outstanding',
        label: 'Outstanding Amount',
        value: formatINRCompact(pending),
        change: pending > 0 ? '+2.0%' : '0%',
        changeType: pending > 0 ? 'down' : 'neutral',
        iconColor: 'bg-rose-500',
        sparkColor: '#EF4444',
        sparkData: spark(5, 28),
      },
      {
        key: 'today',
        label: "Today's Collection",
        value: formatINRCompact(todayCollection),
        change: todayCollection > 0 ? '+18%' : '0%',
        changeType: todayCollection > 0 ? 'up' : 'neutral',
        iconColor: 'bg-teal-500',
        sparkColor: '#14B8A6',
        sparkData: spark(6, 30),
      },
      {
        key: 'refund',
        label: 'Refund Amount',
        value: formatINRCompact(refunded),
        change: refunded > 0 ? '+1.2%' : '0%',
        changeType: 'neutral',
        iconColor: 'bg-violet-500',
        sparkColor: '#8B5CF6',
        sparkData: spark(7, 18),
      },
      {
        key: 'success',
        label: 'Payment Success Rate',
        value: `${successRate}%`,
        change: '+0.8%',
        changeType: 'up',
        iconColor: 'bg-fuchsia-500',
        sparkColor: '#D946EF',
        sparkData: spark(8, 60),
      },
    ],
    totals: { totalRevenue, received, pending, refunded, todayCollection, successRate },
    byStatus,
    byMethod,
    monthlyTrend,
    destinationRevenue,
    executiveRevenue,
    target: { collected, remaining, pct: targetPct, goal: MONTHLY_TARGET },
    reminders: { overdue, dueToday, upcoming },
    recent,
    refundRequests,
    todayCollection,
  };
}

export function buildTimeline(payment) {
  const events = [
    { key: 'created', label: 'Invoice Created', at: payment.createdAt, done: true },
    {
      key: 'advance',
      label: 'Advance / Partial Received',
      at: payment.paidAmount > 0 ? payment.updatedAt || payment.paidAt : null,
      done: Number(payment.paidAmount) > 0,
    },
    {
      key: 'paid',
      label: 'Full Payment Received',
      at: payment.status === 'paid' ? payment.paidAt : null,
      done: payment.status === 'paid',
    },
    {
      key: 'invoice',
      label: 'Invoice Generated',
      at: payment.invoiceNumber ? payment.createdAt : null,
      done: Boolean(payment.invoiceNumber),
    },
    {
      key: 'booking',
      label: 'Booking Linked',
      at: payment.booking ? payment.updatedAt : null,
      done: Boolean(payment.booking),
    },
    {
      key: 'refund',
      label: 'Refund Processed',
      at: payment.refunds?.[0]?.date,
      done: (payment.refunds || []).length > 0,
    },
  ];
  return events;
}

export function nextInvoiceNumber(payments = []) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  let max = 0;
  payments.forEach((p) => {
    const m = String(p.invoiceNumber || '').match(/INV-\d+-(\d+)/i);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
