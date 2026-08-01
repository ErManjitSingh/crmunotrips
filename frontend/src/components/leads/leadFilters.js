import { normalizeLeadStatus } from '../../utils/leadUtils';

export function applyLeadFilters(leads, filters, routeStatus = '') {
  let result = [...leads];

  if (routeStatus) {
    result = result.filter((l) => normalizeLeadStatus(l.status) === routeStatus);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.destination.toLowerCase().includes(q)
    );
  }

  if (filters.status) {
    result = result.filter((l) => normalizeLeadStatus(l.status) === filters.status);
  }

  if (filters.destination) {
    result = result.filter((l) => l.destination === filters.destination);
  }

  if (filters.source) {
    const key = filters.source.toLowerCase();
    result = result.filter((l) => (l.source || '').toLowerCase() === key);
  }

  if (filters.agent) {
    result = result.filter((l) => l.assignedTo?._id === filters.agent);
  }

  if (filters.teamId) {
    result = result.filter((l) => String(l.teamId?._id || l.teamId || '') === String(filters.teamId));
  }

  if (filters.branchId) {
    result = result.filter((l) => String(l.branchId?._id || l.branchId || '') === String(filters.branchId));
  }

  if (filters.state) {
    const state = filters.state.toLowerCase();
    result = result.filter((l) => String(l.state || '').toLowerCase() === state);
  }

  if (filters.priority === 'hot') {
    result = result.filter((l) => l.isHot);
  } else if (filters.priority) {
    result = result.filter((l) => l.priority === filters.priority);
  }

  if (filters.travelMonth !== '') {
    const month = Number(filters.travelMonth);
    result = result.filter((l) => l.travelDate && new Date(l.travelDate).getMonth() === month);
  }

  if (filters.budgetMin) {
    result = result.filter((l) => l.budget >= Number(filters.budgetMin));
  }

  if (filters.budgetMax) {
    result = result.filter((l) => l.budget <= Number(filters.budgetMax));
  }

  if (filters.dateFrom) {
    result = result.filter((l) => l.createdAt && new Date(l.createdAt) >= new Date(filters.dateFrom));
  }

  if (filters.dateTo) {
    result = result.filter((l) => l.createdAt && new Date(l.createdAt) <= new Date(filters.dateTo));
  }

  return result;
}

export function countActiveFilters(filters) {
  return Object.entries(filters).filter(([k, v]) => {
    if (v === '' || v == null) return false;
    if (k === 'search' || k === 'budgetRange') return false;
    return true;
  }).length;
}
