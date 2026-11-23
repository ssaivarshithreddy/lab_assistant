import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, LogIn, ShieldCheck } from "lucide-react";
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

    // 2FA Passcode Security State
    const [requires2FA, setRequires2FA] = useState(false);
    const [twoFactorUserId, setTwoFactorUserId] = useState(null);
    const [twoFactorPasscode, setTwoFactorPasscode] = useState("");
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
                setTwoFactorPasscode("");
                toast.info("Security Passcode (PIN) required to complete sign in.");
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
        if (!twoFactorPasscode || twoFactorPasscode.trim().length < 4) {
            toast.error("Enter your 4-6 digit security passcode (PIN).");
            return;
        }
        setVerifying2FA(true);
        try {
            const res = await apiClient.verify2Fa({
                user_id: twoFactorUserId,
                passcode: twoFactorPasscode.trim(),
            });
            if (res?.token && res?.user) {
                login(res.token, res.user);
                toast.success("Two-Factor Authentication successful!");
                if (res.user.role === "admin") {
                    navigate("/admin/dashboard", { replace: true });
                } else {
                    navigate("/", { replace: true });
                }
            } else {
                toast.error(res?.error || "Invalid security passcode");
            }
        } catch (err) {
            toast.error(err.message || "Failed to verify security passcode");
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
          <AuthShell title="Two-Factor Security" subtitle={`Enter your Security Passcode (PIN) for ${email} to complete sign in.`}>
            <form onSubmit={onVerify2FA} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between" htmlFor="2faPasscode">
                  <span>Enter Security Passcode (PIN)</span>
                  <span className="text-[10px] text-indigo-500 font-bold">Personal 4-6 Digit PIN</span>
                </label>
                <Input
                  id="2faPasscode"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorPasscode}
                  onChange={(e) => setTwoFactorPasscode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 123456"
                  autoFocus
                  required
                  className="bg-muted/50 border-border text-foreground text-center text-xl font-mono tracking-widest rounded-2xl h-12"
                />
                <p className="text-[11px] text-muted-foreground text-center">
                  Protected by your personal offline Security PIN.
                </p>
              </div>

              <Button
                type="submit"
                disabled={verifying2FA}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl h-11 shadow-lg"
              >
                {verifying2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify PIN & Sign In
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
              <Link to="/forgot-password" tabIndex={-1} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Sign In
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full border-border bg-card hover:bg-muted text-foreground text-xs font-semibold rounded-2xl py-5 flex items-center justify-center gap-2"
            onClick={onGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            Sign in with Google
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground font-medium">
          Don't have an account?{" "}
          <Link to="/signup" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
            Create Account
          </Link>
        </p>
      </AuthShell>
    );
}
