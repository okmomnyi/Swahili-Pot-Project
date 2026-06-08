import api from './axios';

export const getPerformance = (params) => api.get('/performance/summary', { params });
export const exportPerformance = (params) =>
  api.get('/performance/summary/export', { params, responseType: 'blob' });
