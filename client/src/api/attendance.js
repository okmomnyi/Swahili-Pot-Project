import api from './axios';

// Instructor / supervisor (authenticated)
export const createSession = (data) => api.post('/attendance/sessions', data);
export const getSessions = () => api.get('/attendance/sessions');
// Supervisor: flat list of every attendance record (with check-in/out) in dept.
export const getSupervisorAttendance = () => api.get('/attendance/sessions/supervisor-view');
export const getSessionRecords = (id) => api.get(`/attendance/sessions/${id}/records`);
export const confirmRecord = (id) => api.patch(`/attendance/records/${id}/confirm`);
export const renameSession = (id, session_label) =>
  api.patch(`/attendance/sessions/${id}`, { session_label });
export const deleteSession = (id) => api.delete(`/attendance/sessions/${id}`);
export const getRecordsRange = (period) =>
  api.get('/attendance/records-range', { params: { period } });

// Public attendance (no auth) — trainees enter only name + phone
export const getAttendSession = (token) => api.get(`/attend/${token}`);
export const checkIn = (token, data) => api.post(`/attend/${token}`, data);
