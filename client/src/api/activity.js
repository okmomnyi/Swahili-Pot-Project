import api from './axios';

export const getActivity = (limit) =>
  api.get('/activity', { params: limit ? { limit } : {} });
