import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export const devicesApi = {
  list: () => client.get('/api/devices').then(r => r.data),
  get: (id) => client.get(`/api/devices/${id}`).then(r => r.data),
  create: (data) => client.post('/api/devices', data).then(r => r.data),
  update: (id, data) => client.patch(`/api/devices/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/api/devices/${id}`),
};

export const scansApi = {
  list: () => client.get('/api/scans').then(r => r.data),
  get: (id) => client.get(`/api/scans/${id}`).then(r => r.data),
  create: (data) => client.post('/api/scans', data).then(r => r.data),
  request: () => client.post('/api/scans', { scan_type: 'manual' }).then(r => r.data),
};

export const observationsApi = {
  list: (params) => client.get('/api/observations', { params }).then(r => r.data),
  get: (id) => client.get(`/api/observations/${id}`).then(r => r.data),
};

export const networksApi = {
  list: () => client.get('/api/networks').then(r => r.data),
};

export const diagnosticsApi = {
  list: () => client.get('/api/diagnostics').then(r => r.data),
};
