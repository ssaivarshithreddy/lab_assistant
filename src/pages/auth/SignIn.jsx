import { useState } from "react";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/pages/auth/AuthShell";
import { signInWithEmail, signInWithGoogle } from "@/services/authService";
import { useAuth } from "@/features/auth/AuthProvider";

function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
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
            if (data?.token && data?.user) {
                login(data.token, data.user);
            }
            toast.success("Signed in successfully.");
            
            // If user is an admin, navigate directly to Admin Dashboard
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
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold rounded-2xl py-6 shadow-xl freud-glow-indigo text-sm flex items-center justify-center gap-2"
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
