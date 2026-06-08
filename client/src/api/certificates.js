import api from './axios';

export const generateCertificate = (data) =>
  api.post('/certificates/generate', data, { responseType: 'blob' });
