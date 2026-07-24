/** ISO date strings (YYYY-MM-DD) for today's createdAt filter — local calendar day */
export function getTodayDateRange() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const date = `${y}-${m}-${d}`;
  return { dateFrom: date, dateTo: date };
}
