import api from './axios';

// --- Public verification (no auth) ---
export const getDocumentRecord = (documentId) => api.get(`/verify/${documentId}`);
export const checkDocumentFile = (formData) =>
  api.post('/verify/check', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
// Direct URL — opened in a new tab to trigger the .pem download (Content-Disposition).
export const publicKeyUrl = () => `${api.defaults.baseURL}/verify/public-key`;

// --- Supervisor registry ---
export const getDepartmentDocuments = (params) => api.get('/documents', { params });
export const getDocument = (documentId) => api.get(`/documents/${documentId}`);
export const revokeDocument = (documentId, reason) =>
  api.post(`/documents/${documentId}/revoke`, { reason });
export const unrevokeDocument = (documentId, reason) =>
  api.post(`/documents/${documentId}/unrevoke`, { reason });

// --- Admin registry ---
export const getAdminDocuments = (params) => api.get('/admin/documents', { params });
export const getAdminDocument = (documentId) => api.get(`/admin/documents/${documentId}`);
export const getAdminDocumentStats = () => api.get('/admin/documents/stats');
