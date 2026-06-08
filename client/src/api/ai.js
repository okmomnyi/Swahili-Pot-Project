import api from './axios';

export const getAttacheeProfile = (attacheeId) =>
  api.get(`/ai/attachees/${attacheeId}/profile`);
export const refreshAttacheeProfile = (attacheeId) =>
  api.post(`/ai/attachees/${attacheeId}/profile/refresh`);
export const generateReport = (attacheeId, reportType) =>
  api.post(`/ai/attachees/${attacheeId}/reports`, { report_type: reportType });
export const saveReport = (reportId, data) => api.patch(`/ai/reports/${reportId}`, data);
export const clearAssistantHistory = () => api.delete('/ai/assistant/history');

// SSE streaming uses fetch (axios can't stream response bodies in the browser).
export const assistantStreamUrl = () => `${api.defaults.baseURL}/ai/assistant`;
