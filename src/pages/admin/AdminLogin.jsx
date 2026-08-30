import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, AlertCircle, Loader2, ShieldCheck, Activity, Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { adminAuthService } from "@/services/adminAuthService";

const AdminLogin = () => {
    const navigate = useNavigate();
    const { theme, setTheme } = useTheme();
    const credentials = adminAuthService.getAdminCredentials();
    const [email, setEmail] = useState(credentials.email);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        if (!email || !password) {
            setError("Email and password are required");
            return;
        }
        setLoading(true);
        try {
            const result = await adminAuthService.login(email, password);
            if (result.success) {
                toast.success("Admin logged in successfully!");
                navigate("/admin/dashboard", { replace: true });
            }
            else {
                setError(result.error || "Login failed");
                toast.error(result.error || "Login failed");
            }
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : "An error occurred";
            setError(errorMsg);
            toast.error(errorMsg);
        }
        finally {
            setLoading(false);
        }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 font-sans selection:bg-amber-500/30 relative transition-colors duration-300">
        {/* Top Right Theme Toggle */}
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
              setTheme(nextTheme);
              toast.success(`Theme mode: ${nextTheme.toUpperCase()}`);
            }}
            className="rounded-2xl border-border bg-card text-foreground hover:bg-muted transition-all shadow-sm"
            title={`Current Theme: ${(theme || "system").toUpperCase()}. Click to toggle Light / Dark / System Auto Mode.`}
          >
            {theme === "light" && <Sun className="h-4 w-4 text-amber-500" />}
            {theme === "dark" && <Moon className="h-4 w-4 text-indigo-400" />}
            {theme === "system" && <Monitor className="h-4 w-4 text-muted-foreground" />}
          </Button>
        </div>

        <Card className="w-full max-w-md freud-card border-border rounded-3xl shadow-2xl overflow-hidden">
          <CardHeader className="text-center border-b border-border pb-6 pt-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-tr from-amber-500 to-red-500 text-white shadow-xl freud-glow-indigo">
                <ShieldCheck className="w-8 h-8" />
              </div>
            </div>
            <CardTitle className="text-2xl font-extrabold text-foreground">Freud Admin Portal</CardTitle>
            <p className="text-xs text-muted-foreground mt-1.5 font-medium">Access system telemetry & user management</p>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</span>
              </div>
            )}

            <Alert className="bg-amber-500/10 border-amber-500/30 rounded-2xl">
              <AlertDescription className="text-xs text-amber-700 dark:text-amber-200">
                <span className="font-bold text-amber-800 dark:text-amber-300">Default Admin Credentials:</span>
                <div className="mt-2 space-y-1 text-amber-800 dark:text-amber-200 font-medium">
                  <p>Email: <code className="bg-card px-2 py-0.5 rounded-lg border border-amber-500/30 font-mono text-amber-600 dark:text-amber-300">{credentials.email}</code></p>
                  <p>Password: <code className="bg-card px-2 py-0.5 rounded-lg border border-amber-500/30 font-mono text-amber-600 dark:text-amber-300">{credentials.password}</code></p>
                </div>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">Admin Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-2xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-2xl text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white font-bold rounded-2xl py-6 shadow-xl freud-glow-indigo text-base transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating Admin...
                  </>
                ) : (
                  "Access Admin Dashboard"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
};

export default AdminLogin;
