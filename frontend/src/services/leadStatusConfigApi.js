import API from '../api/axios';

export async function fetchLeadStatusConfig() {
  const { data } = await API.get('/lead-status-config');
  return data;
}

export async function fetchLeadStatusConfigAdmin() {
  const { data } = await API.get('/lead-status-config/admin');
  return data;
}

export async function saveLeadStatusConfig(payload) {
  const { data } = await API.put('/lead-status-config', payload);
  return data;
}

export async function resetLeadStatusConfig() {
  const { data } = await API.post('/lead-status-config/reset');
  return data;
}
