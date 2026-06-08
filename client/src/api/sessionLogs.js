import api from './axios';

export const getSessionLogs = (params) => api.get('/session-logs', { params });
export const createSessionLog = (data) => api.post('/session-logs', data);
export const updateSessionLog = (id, data) => api.patch(`/session-logs/${id}`, data);
export const deleteSessionLog = (id) => api.delete(`/session-logs/${id}`);
