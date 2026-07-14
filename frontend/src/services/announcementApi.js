import API from '../api/axios';

export async function fetchAnnouncementFeed() {
  const { data } = await API.get('/announcements/feed', { skipSuccessToast: true });
  return data;
}

export async function fetchAnnouncementsAdmin() {
  const { data } = await API.get('/announcements', { skipSuccessToast: true });
  return data;
}

export async function createAnnouncement(payload) {
  const { data } = await API.post('/announcements', payload);
  return data;
}

export async function updateAnnouncement(id, payload) {
  const { data } = await API.put(`/announcements/${id}`, payload);
  return data;
}

export async function deleteAnnouncement(id) {
  const { data } = await API.delete(`/announcements/${id}`);
  return data;
}

export async function dismissAnnouncement(id, remindLaterHours = 0) {
  const { data } = await API.post(`/announcements/${id}/dismiss`, { remindLaterHours }, { skipSuccessToast: true });
  return data;
}

export async function markAnnouncementRead(id) {
  const { data } = await API.post(`/announcements/${id}/read`, {}, { skipSuccessToast: true });
  return data;
}

export async function markAnnouncementPopupSeen(id) {
  const { data } = await API.post(`/announcements/${id}/popup-seen`, {}, { skipSuccessToast: true });
  return data;
}

export async function seedAnnouncementDemo() {
  const { data } = await API.post('/announcements/seed-demo');
  return data;
}
