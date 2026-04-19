import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const staff = {
  getAll: () => api.get('/staff'),
  getById: (id) => api.get(`/staff/${id}`),
  getSchedule: (id) => api.get(`/staff/${id}/schedule`),
  updateAvailability: (id, is_available) => api.patch(`/staff/${id}/availability`, { is_available }),
}

export const schedule = {
  getToday: (date) => api.get('/schedule/today', { params: date ? { date_str: date } : {} }),
  getWeek: () => api.get('/schedule/week'),
  getHeatmap: () => api.get('/schedule/heatmap'),
  getConflicts: () => api.get('/schedule/conflicts'),
  getSummary: () => api.get('/schedule/summary'),
  generate: (data = {}) => api.post('/schedule/generate', data),
  applySubstitution: (data) => api.post('/schedule/substitution', data),
}

export const tasks = {
  getAll: (params) => api.get('/tasks', { params }),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.patch(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
}

export const attendance = {
  getToday: () => api.get('/attendance/today'),
  getSummary: () => api.get('/attendance/summary'),
  getHistory: (days) => api.get('/attendance/history', { params: { days } }),
  create: (data) => api.post('/attendance', data),
  sendCanteen: (data = {}) => api.post('/attendance/send-canteen', data),
}

export const incidents = {
  getAll: (status) => api.get('/incidents', { params: status ? { status } : {} }),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.patch(`/incidents/${id}`, data),
}

export const messages = {
  getAll: () => api.get('/messages'),
  parse: (data) => api.post('/messages/parse', data),
}

export const ai = {
  voiceToTask: (transcript, options = {}) => api.post('/ai/voice-to-task', { transcript, ...options }),
  findSubstitution: (data) => api.post('/ai/find-substitution', data),
  simulateAbsence: (absent_teacher_id) => api.post('/ai/simulate-absence', { absent_teacher_id }),
  rag: (question, context) => api.post('/ai/rag', { question, context }),
  insights: () => api.get('/ai/insights'),
  risks: () => api.get('/ai/risks'),
  prediction: () => api.get('/ai/prediction'),
}

export const notifications = {
  getAll: (staff_id = 1) => api.get('/notifications', { params: { staff_id } }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: (staff_id = 1) => api.post('/notifications/read-all', { staff_id }),
}

export const dashboard = {
  get: () => api.get('/dashboard'),
  optimizeDay: (data = {}) => api.post('/dashboard/optimize-day', data),
}

export default api
