const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export function getToken() {
  return localStorage.getItem('labsense_jwt_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('labsense_jwt_token', token);
  } else {
    localStorage.removeItem('labsense_jwt_token');
  }
}

export function removeToken() {
  localStorage.removeItem('labsense_jwt_token');
}

export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.error) errorMessage = errorData.error;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  // If response is empty or 204 No Content
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return response;
}

export const apiClient = {
  // Auth
  signUp: (data) => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  signIn: (data) => apiFetch('/auth/signin', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => apiFetch('/auth/me'),
  updateProfile: (data) => apiFetch('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) => apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (data) => apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getReports: () => apiFetch('/reports'),
  getReport: (id) => apiFetch(`/reports/${id}`),
  createReport: (formDataOrJson) => {
    if (formDataOrJson instanceof FormData) {
      return apiFetch('/reports', { method: 'POST', body: formDataOrJson });
    }
    return apiFetch('/reports', { method: 'POST', body: JSON.stringify(formDataOrJson) });
  },
  deleteReport: (id) => apiFetch(`/reports/${id}`, { method: 'DELETE' }),
  getReportFileUrl: (id) => {
    const token = getToken();
    return `${API_BASE_URL}/reports/${id}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // Chat
  getChatMessages: (reportId) => apiFetch(`/chat${reportId ? `?report_id=${reportId}` : ''}`),
  sendChatMessage: (data) => apiFetch('/chat', { method: 'POST', body: JSON.stringify(data) }),

  // RAG Search
  searchRagChunks: (data) => apiFetch('/rag/search', { method: 'POST', body: JSON.stringify(data) }),

  // Admin
  adminLogin: (data) => apiFetch('/admin/login', { method: 'POST', body: JSON.stringify(data) }),
  getAdminStats: () => apiFetch('/admin/stats'),
  getAdminUsers: () => apiFetch('/admin/users'),
  updateUserRole: (id, role) => apiFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteAdminUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
  getAdminReports: () => apiFetch('/admin/reports'),
  deleteAdminReport: (id) => apiFetch(`/admin/reports/${id}`, { method: 'DELETE' }),
  getAdminDbTables: () => apiFetch('/admin/db/tables'),
  getAdminDbTableRows: (tableName, limit = 50, offset = 0) => apiFetch(`/admin/db/table/${tableName}?limit=${limit}&offset=${offset}`),
  executeAdminSqlQuery: (sql) => apiFetch('/admin/db/query', { method: 'POST', body: JSON.stringify({ sql }) }),
  reindexReportChunks: (reportId) => apiFetch(`/admin/reports/${reportId}/reindex`, { method: 'POST' }),
  getAdminMinioObjects: () => apiFetch('/admin/minio/objects'),
};
