import { apiClient, removeToken, setToken, getToken } from "@/lib/apiClient";

const ADMIN_SESSION_KEY = "admin_session_token";

export const adminAuthService = {
  login: async (email, password) => {
    try {
      const res = await apiClient.adminLogin({ email, password });
      if (res?.token) {
        setToken(res.token);
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ email, token: res.token, loginTime: Date.now() }));
        return { success: true, token: res.token };
      }
      return { success: false, error: "Invalid admin credentials" };
    } catch (err) {
      return { success: false, error: err.message || "Admin login failed" };
    }
  },

  logout: () => {
    removeToken();
    localStorage.removeItem(ADMIN_SESSION_KEY);
  },

  getSession: () => {
    const token = getToken();
    const session = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!token || !session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  },

  isAuthenticated: () => {
    return adminAuthService.getSession() !== null;
  },

  getAdminCredentials: () => {
    return {
      email: "admin@labsense.com",
      password: "admin123",
    };
  },
};
