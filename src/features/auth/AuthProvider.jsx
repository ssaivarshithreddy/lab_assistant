import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, getToken, setToken, removeToken } from "@/lib/apiClient";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkUserSession = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient.getMe();
      if (data?.user) {
        setUser(data.user);
        setSession({ access_token: token, user: data.user });
      } else {
        removeToken();
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      console.warn("Auth Session check failed:", err.message);
      removeToken();
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserSession();

    const handleUnauthorized = () => {
      setUser(null);
      setSession(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
    setSession({ access_token: token, user: userData });
  };

  const updateUser = (userData, token) => {
    if (token) setToken(token);
    setUser(userData);
    setSession((prev) => ({ ...prev, user: userData, access_token: token || prev?.access_token }));
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setSession(null);
  };

  const value = useMemo(
    () => ({ user, session, loading, login, logout, updateUser, checkUserSession }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
