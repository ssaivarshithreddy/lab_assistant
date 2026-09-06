import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/pages/auth/AuthShell";
import { signInWithEmail, signInWithGoogle } from "@/services/authService";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";

function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // 2FA Security State
    const [requires2FA, setRequires2FA] = useState(false);
    const [twoFactorUserId, setTwoFactorUserId] = useState(null);
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [verifying2FA, setVerifying2FA] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    async function onSubmit(e) {
        e.preventDefault();
        if (!validEmail(email)) {
            toast.error("Enter a valid email address.");
            return;
        }
        if (!password) {
            toast.error("Password is required.");
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await signInWithEmail(email.trim(), password);
            if (error) {
                toast.error(error.message);
                return;
            }

            if (data?.requires_2fa) {
                setRequires2FA(true);
                setTwoFactorUserId(data.user_id);
                toast.info("2FA Code Generated! Please enter the 6-digit security code.");
                return;
            }

            if (data?.token && data?.user) {
                login(data.token, data.user);
            }
            toast.success("Signed in successfully.");
            
            if (data?.user?.role === "admin") {
                navigate("/admin/dashboard", { replace: true });
            } else {
                const nextPath = location.state?.from?.pathname || "/";
                navigate(nextPath, { replace: true });
            }
        } finally {
            setLoading(false);
        }
    }

    async function onVerify2FA(e) {
        e.preventDefault();
        if (!twoFactorCode || twoFactorCode.length < 6) {
            toast.error("Enter 6-digit security code.");
            return;
        }
        setVerifying2FA(true);
        try {
            const res = await apiClient.verify2Fa({ user_id: twoFactorUserId, code: twoFactorCode.trim() });
            if (res?.token && res?.user) {
                login(res.token, res.user);
                toast.success("2FA Authentication successful!");
                if (res.user.role === "admin") {
                    navigate("/admin/dashboard", { replace: true });
                } else {
                    navigate("/", { replace: true });
                }
            } else {
                toast.error(res?.error || "Invalid 2FA security code");
            }
        } catch (err) {
            toast.error(err.message || "Failed to verify 2FA code");
        } finally {
            setVerifying2FA(false);
        }
    }

    async function onGoogleSignIn() {
        setGoogleLoading(true);
        try {
            const { error } = await signInWithGoogle();
            if (error) {
                toast.error(error.message);
            }
        } finally {
            setGoogleLoading(false);
        }
    }

    if (requires2FA) {
        return (
          <AuthShell title="Two-Factor Authentication" subtitle={`A 6-digit security code was dispatched for ${email}.`}>
            <form onSubmit={onVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between" htmlFor="2faCode">
                  <span>Enter 6-Digit 2FA Security Code</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Check Console / Email</span>
                </label>
                <Input
                  id="2faCode"
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="e.g. 123456"
                  autoFocus
                  required
                  className="bg-muted/50 border-border text-foreground text-center text-lg font-mono tracking-widest rounded-2xl h-12"
                />
              </div>

              <Button
                type="submit"
                disabled={verifying2FA}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl h-11 shadow-lg"
              >
                {verifying2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify & Authenticate
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setRequires2FA(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to Password Login
              </Button>
            </form>
          </AuthShell>
        );
    }

    return (
      <AuthShell title="Welcome Back" subtitle="Sign in with your user or admin credentials to access your dashboard.">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="email">Email Address</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-2xl text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground" htmlFor="password">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-2xl text-sm pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((s) => !s)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold rounded-2xl py-6 shadow-xl glow-indigo text-sm flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Sign In
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full border-border bg-card text-foreground hover:bg-muted rounded-2xl py-5 text-sm font-semibold"
            onClick={onGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue with Google
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground font-medium">
          Don't have an account yet?{" "}
          <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
            Create Account
          </Link>
        </p>
      </AuthShell>
    );
}
