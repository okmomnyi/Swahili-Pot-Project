import api from './axios';

export const getVisitors = (date) => api.get('/visitors', { params: date ? { date } : {} });
export const logVisitor = (data) => api.post('/visitors', data);
export const checkoutVisitor = (id) => api.patch(`/visitors/${id}/checkout`);
