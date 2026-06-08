import api from './axios';

export const getPrograms = () => api.get('/programs');
export const createProgram = (data) => api.post('/programs', data);
export const updateProgram = (id, data) => api.patch(`/programs/${id}`, data);
export const getProgramEnrollments = (id) => api.get(`/programs/${id}/enrollments`);
export const enrollTrainees = (id, trainee_ids) =>
  api.post(`/programs/${id}/enroll`, { trainee_ids });
export const removeEnrollment = (id, traineeId) =>
  api.delete(`/programs/${id}/enrollments/${traineeId}`);
