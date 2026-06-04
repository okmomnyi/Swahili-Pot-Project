import api from './axios';

// Instructor / supervisor (authenticated)
export const createSession = (data) => api.post('/attendance/sessions', data);
export const getSessions = () => api.get('/attendance/sessions');
export const getSupervisorSessions = () => api.get('/attendance/sessions/supervisor-view');
export const getSessionRecords = (id) => api.get(`/attendance/sessions/${id}/records`);
export const confirmRecord = (id) => api.patch(`/attendance/records/${id}/confirm`);
export const renameSession = (id, session_label) =>
  api.patch(`/attendance/sessions/${id}`, { session_label });

// Public attendance (no auth) — trainees enter only name + phone
export const getAttendSession = (token) => api.get(`/attend/${token}`);
export const checkIn = (token, data) => api.post(`/attend/${token}`, data);
