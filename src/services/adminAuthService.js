const ADMIN_SESSION_KEY = "admin_session_token";

// Hardcoded admin credentials - simple and reliable
const ADMIN_EMAIL = "admin@labassistant.com";
const ADMIN_PASSWORD = "Admin@123456";

export const adminAuthService = {
  login: async (email, password) => {
    try {
      console.log("Admin login attempt for email:", email);

      // Validate against hardcoded admin credentials
      if (email.trim() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        console.warn("Invalid admin credentials provided");
        return { success: false, error: "Invalid email or password" };
      }

      const token = btoa(`${email}:${Date.now()}`);
      const session = {
        email,
        token,
        loginTime: Date.now(),
      };
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));

      console.log("Admin session created successfully for:", email);
      return { success: true, token };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      console.error("Login exception:", errorMsg);
      return { success: false, error: errorMsg };
    }
  },

  logout: () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    console.log("Admin session cleared");
  },

  getSession: () => {
    const session = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!session) return null;

    try {
      const parsed = JSON.parse(session);
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.loginTime > oneWeekMs) {
        adminAuthService.logout();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },

  isAuthenticated: () => {
    return adminAuthService.getSession() !== null;
  },

  getAdminCredentials: () => {
    return {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    };
  },
};
