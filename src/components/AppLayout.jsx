import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Upload, LayoutDashboard, MessageSquareHeart, Moon, Sun, Monitor, LogOut, User, ShieldAlert, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/AuthProvider";
import { signOut } from "@/services/authService";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Upload Report", icon: Upload, end: true },
  { to: "/dashboard", label: "Health Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "AI Health Assistant", icon: MessageSquareHeart },
];

const AppLayout = () => {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    logout();
    toast.success("Logged out successfully.");
    navigate("/signin", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Glassmorphic Header Navigation */}
      <header className="sticky top-0 z-40 glass-panel border-b border-border shadow-md">
        <div className="container mx-auto flex h-20 items-center justify-between gap-4 px-4 sm:px-6">
          {/* Brand Logo */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg glow-indigo transition-transform group-hover:scale-105">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                LabSense <span className="text-[10px] font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">AI Medical</span>
              </div>
              <div className="text-xs text-muted-foreground font-medium">AI Health & Diagnostics</div>
            </div>
          </NavLink>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-2 md:flex bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 p-1.5 rounded-2xl backdrop-blur-md">
            {nav.map(({ to, label, icon: Icon, end }) => {
              const isActive = end ? pathname === "/" : (to !== "/" && pathname.startsWith(to));
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md glow-indigo"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-500 dark:text-slate-400")} />
                  {label}
                </NavLink>
              );
            })}

            {user?.role === "admin" && (
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10",
                    isActive ? "bg-amber-500/20 shadow-md border-amber-400/50 text-amber-700 dark:text-amber-200 font-bold" : ""
                  )
                }
              >
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Admin Portal
              </NavLink>
            )}
          </nav>

          {/* User Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Mode Switcher */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
                setTheme(nextTheme);
                toast.success(`Theme mode: ${nextTheme.toUpperCase()}`);
              }}
              className="rounded-2xl border-border bg-card text-foreground hover:bg-muted transition-all shadow-sm shrink-0"
              title={`Current Theme: ${(theme || "system").toUpperCase()}. Click to toggle Light / Dark / System Auto Mode.`}
            >
              {theme === "light" && <Sun className="h-4 w-4 text-amber-500" />}
              {theme === "dark" && <Moon className="h-4 w-4 text-indigo-400" />}
              {theme === "system" && <Monitor className="h-4 w-4 text-muted-foreground" />}
            </Button>

            {/* User Profile Button */}
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pr-4 hover:border-indigo-500/40 hover:bg-muted transition-all text-left group shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-xs font-bold text-white shadow-sm">
                {(user?.full_name || user?.email || "U").slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block max-w-[130px]">
                <div className="truncate text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  {user?.full_name || "User"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                  <span>{user?.role || "user"}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
                </div>
              </div>
            </button>

            <Button
              variant="outline"
              size="icon"
              className="rounded-2xl border-border bg-card text-foreground hover:bg-muted hover:text-destructive transition-all shadow-sm"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <nav className="container mx-auto flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {nav.map(({ to, label, icon: Icon, end }) => {
            const isActive = end ? pathname === "/" : (to !== "/" && pathname.startsWith(to));
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            );
          })}
          {user?.role === "admin" && (
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) =>
                cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30",
                  isActive ? "bg-amber-500/20 border-amber-500" : ""
                )
              }
            >
              <ShieldAlert className="h-4 w-4" />
              Admin
            </NavLink>
          )}
        </nav>
      </header>

      {/* Main Content View */}
      <main className="container mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* LabSense Footer */}
      <footer className="container mx-auto py-8 text-center text-xs text-muted-foreground border-t border-border mt-12 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold tracking-wide">
          <Sparkles className="h-3.5 w-3.5" /> LabSense AI Health & Clinical Intelligence Engine
        </div>
        <p>This application is for informational purposes. Always consult a licensed physician for medical diagnoses.</p>
      </footer>
    </div>
  );
};

export default AppLayout;
