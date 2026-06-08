import api from './axios';

export const getTrainees = () => api.get('/trainees');
export const createTrainee = (data) => api.post('/trainees', data);
export const deactivateTrainee = (id) => api.delete(`/trainees/${id}`);

export const bulkImportTrainees = (file) => {
  const fd = new FormData();
  fd.append('csv_file', file);
  return api.post('/trainees/bulk-import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
