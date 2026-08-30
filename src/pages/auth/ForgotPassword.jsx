import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/pages/auth/AuthShell";
import { sendPasswordReset } from "@/services/authService";

function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        if (!validEmail(email)) {
            toast.error("Enter a valid email address.");
            return;
        }
        setLoading(true);
        try {
            const { error } = await sendPasswordReset(email.trim());
            if (error) {
                toast.error(error.message);
                return;
            }
            toast.success("Password reset email sent.");
        }
        finally {
            setLoading(false);
        }
    }

    return (
      <AuthShell title="Reset Password" subtitle="We'll send you a password reset link to your registered email.">
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
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold rounded-2xl py-6 shadow-xl freud-glow-indigo text-sm flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send Reset Link
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground font-medium">
          Remember your password?{" "}
          <Link to="/signin" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </AuthShell>
    );
}
