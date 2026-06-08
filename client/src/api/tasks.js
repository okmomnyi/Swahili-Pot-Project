import api from './axios';

export const getTasks = (params) => api.get('/tasks', { params });
export const createTask = (data) => api.post('/tasks', data);
export const updateTaskStatus = (id, status) => api.patch(`/tasks/${id}/status`, { status });
export const reviewTask = (id, feedback) => api.patch(`/tasks/${id}/review`, { feedback });
export const getTaskComments = (id) => api.get(`/tasks/${id}/comments`);
export const postTaskComment = (id, body) => api.post(`/tasks/${id}/comments`, { body });
