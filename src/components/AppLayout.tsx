import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Upload, LayoutDashboard, MessageSquareHeart, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { signOut } from "@/services/authService";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Upload", icon: Upload, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistant", label: "Assistant", icon: MessageSquareHeart },
];

const AppLayout = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { pathname } = useLocation();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Logged out successfully.");
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-elevated">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">LabSense</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Lab Assistant</div>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive || (to !== "/" && pathname.startsWith(to))
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="max-w-[180px] truncate text-xs font-medium">{user?.user_metadata?.full_name || "User"}</div>
              <div className="max-w-[180px] truncate text-[11px] text-muted-foreground">{user?.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <nav className="container flex gap-1 overflow-x-auto pb-2 md:hidden">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="container py-8">
        <Outlet />
      </main>

      <footer className="container py-6 text-center text-xs text-muted-foreground">
        ⚕️ This is not medical advice. Always consult a qualified healthcare professional.
      </footer>
    </div>
  );
};

export default AppLayout;
