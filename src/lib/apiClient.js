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

    if (response.status === 401) {
      removeToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

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
  // Auth & Verification
  signUp: (data) => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  signIn: (data) => apiFetch('/auth/signin', { method: 'POST', body: JSON.stringify(data) }),
  verify2Fa: (data) => apiFetch('/auth/verify-2fa', { method: 'POST', body: JSON.stringify(data) }),
  toggle2Fa: (enabled) => apiFetch('/auth/2fa/toggle', { method: 'POST', body: JSON.stringify({ enabled }) }),
  sendEmailOtp: (email) => apiFetch('/auth/send-email-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmailOtp: (data) => apiFetch('/auth/verify-email-otp', { method: 'POST', body: JSON.stringify(typeof data === 'string' ? { code: data } : data) }),
  sendPhoneOtp: (phone_number) => apiFetch('/auth/send-phone-otp', { method: 'POST', body: JSON.stringify({ phone_number }) }),
  verifyPhoneOtp: (data) => apiFetch('/auth/verify-phone-otp', { method: 'POST', body: JSON.stringify(data) }),
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
  getReportById: (id) => apiFetch(`/reports/${id}`),
  getReportReasoning: (id) => apiFetch(`/reports/${id}/reasoning`),
  deleteReport: (id) => apiFetch(`/reports/${id}`, { method: 'DELETE' }),
  getReportFileUrl: (id) => {
    const token = getToken();
    return `${API_BASE_URL}/reports/${id}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  getChatMessages: (reportId) => {
    const q = reportId && reportId !== 'null' ? `?report_id=${encodeURIComponent(reportId)}` : '';
    return apiFetch(`/chat${q}`);
  },
  sendChatMessage: (data) => apiFetch('/chat', { method: 'POST', body: JSON.stringify(data) }),
  deleteChatMessages: (reportId) => {
    const q = reportId && reportId !== 'null' ? `?report_id=${encodeURIComponent(reportId)}` : '';
    return apiFetch(`/chat${q}`, { method: 'DELETE' });
  },
  clearAllChatMessages: () => apiFetch('/chat/all', { method: 'DELETE' }),
  getChatThreads: () => apiFetch('/chat/threads'),

  // RAG Search
  searchRagChunks: (data) => apiFetch('/rag/search', { method: 'POST', body: JSON.stringify(data) }),

  // Admin & DB Portal
  adminLogin: (data) => apiFetch('/admin/login', { method: 'POST', body: JSON.stringify(data) }),
  getAdminStats: () => apiFetch('/admin/stats'),
  getAdminUsers: () => apiFetch('/admin/users'),
  updateUserRole: (id, role) => apiFetch(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteAdminUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE' }),
  getAdminReports: () => apiFetch('/admin/reports'),
  deleteAdminReport: (id) => apiFetch(`/admin/reports/${id}`, { method: 'DELETE' }),
  getAdminDbTables: () => apiFetch('/admin/db/tables'),
  getAdminDbTableDetail: (tableName, page = 1, limit = 50) => apiFetch(`/admin/db/tables/${tableName}?page=${page}&limit=${limit}`),
  executeAdminSqlQuery: (sql_query) => apiFetch('/admin/db/query', { method: 'POST', body: JSON.stringify({ sql_query }) }),
  getAdminDbHealthStats: () => apiFetch('/admin/db/stats'),
  reindexReportChunks: (reportId) => apiFetch(`/admin/reports/${reportId}/reindex`, { method: 'POST' }),
  getAdminMinioObjects: () => apiFetch('/admin/minio/objects'),
};
