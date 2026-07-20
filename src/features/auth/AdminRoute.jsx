import { Navigate } from "react-router-dom";
import { adminAuthService } from "@/services/adminAuthService";

export const AdminRoute = ({ children }) => {
  const isAuthenticated = adminAuthService.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};
