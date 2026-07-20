import API from '../api/axios';

export const hrApi = {
  dashboard: () => API.get('/hr/dashboard', { skipSuccessToast: true }).then((r) => r.data),
  employees: (params) => API.get('/hr/employees', { params, skipSuccessToast: true }).then((r) => r.data),
  employee: (id) => API.get(`/hr/employees/${id}`, { skipSuccessToast: true }).then((r) => r.data),
  createEmployee: (body) => API.post('/hr/employees', body).then((r) => r.data),
  updateEmployee: (id, body) => API.put(`/hr/employees/${id}`, body).then((r) => r.data),
  deleteEmployee: (id) => API.delete(`/hr/employees/${id}`).then((r) => r.data),
  departments: () => API.get('/hr/departments', { skipSuccessToast: true }).then((r) => r.data),
  createDepartment: (body) => API.post('/hr/departments', body).then((r) => r.data),
  updateDepartment: (id, body) => API.put(`/hr/departments/${id}`, body).then((r) => r.data),
  deleteDepartment: (id) => API.delete(`/hr/departments/${id}`).then((r) => r.data),
  designations: (params) => API.get('/hr/designations', { params, skipSuccessToast: true }).then((r) => r.data),
  createDesignation: (body) => API.post('/hr/designations', body).then((r) => r.data),
  updateDesignation: (id, body) => API.put(`/hr/designations/${id}`, body).then((r) => r.data),
  deleteDesignation: (id) => API.delete(`/hr/designations/${id}`).then((r) => r.data),
  holidays: (params) => API.get('/hr/holidays', { params, skipSuccessToast: true }).then((r) => r.data),
  createHoliday: (body) => API.post('/hr/holidays', body).then((r) => r.data),
  deleteHoliday: (id) => API.delete(`/hr/holidays/${id}`).then((r) => r.data),
  leaves: (params) => API.get('/hr/leaves', { params, skipSuccessToast: true }).then((r) => r.data),
  createLeave: (body) => API.post('/hr/leaves', body).then((r) => r.data),
  reviewLeave: (id, body) => API.patch(`/hr/leaves/${id}/review`, body).then((r) => r.data),
};
