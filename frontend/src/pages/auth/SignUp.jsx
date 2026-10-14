import { useState } from "react";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/pages/auth/AuthShell";
import { signUpWithEmail } from "@/services/authService";
import { useAuth } from "@/features/auth/AuthProvider";

import { apiClient } from "@/lib/apiClient";
import { ShieldCheck } from "lucide-react";

function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignUp() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Signup OTP Verification State
    const [requiresOtp, setRequiresOtp] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    async function onSubmit(e) {
        e.preventDefault();
        if (fullName.trim().length < 2) {
            toast.error("Enter your full name.");
            return;
        }
        if (!validEmail(email)) {
            toast.error("Enter a valid email address.");
            return;
        }
        if (password.length < 8) {
            toast.error("Password must be at least 8 characters.");
            return;
        }
        setLoading(true);
        try {
            const res = await apiClient.signUp({
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                phone_number: phoneNumber.trim() || null,
                password,
            });

            if (res?.requires_verification) {
                setRequiresOtp(true);
                toast.info(res.message || "OTP Sent! Please enter the 6-digit verification code.");
                return;
            }

            if (res?.token && res?.user) {
                login(res.token, res.user);
                toast.success("Account created & verified successfully!");
                navigate("/", { replace: true });
            }
        } catch (err) {
            toast.error(err.message || "Failed to initiate signup");
        } finally {
            setLoading(false);
        }
    }

    async function onVerifySignupOtp(e) {
        e.preventDefault();
        if (!otpCode || otpCode.trim().length < 6) {
            toast.error("Enter 6-digit verification code.");
            return;
        }
        setVerifyingOtp(true);
        try {
            const res = await apiClient.signUp({
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                phone_number: phoneNumber.trim() || null,
                password,
                verification_code: otpCode.trim(),
                verification_type: "email",
            });

            if (res?.token && res?.user) {
                login(res.token, res.user);
                toast.success("Account created & identity verified successfully!");
                navigate("/", { replace: true });
            } else {
                toast.error(res?.error || "Invalid verification code");
            }
        } catch (err) {
            toast.error(err.message || "Verification failed");
        } finally {
            setVerifyingOtp(false);
        }
    }

    if (requiresOtp) {
        return (
          <AuthShell title="Verify Your Identity" subtitle={`A 6-digit verification code was dispatched to ${email}.`}>
            <form onSubmit={onVerifySignupOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between" htmlFor="signupOtpCode">
                  <span>Enter 6-Digit Email Verification Code</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Check Console / Inbox</span>
                </label>
                <Input
                  id="signupOtpCode"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="e.g. 123456"
                  autoFocus
                  required
                  className="bg-muted/50 border-border text-foreground text-center text-lg font-mono tracking-widest rounded-2xl h-12"
                />
              </div>

              <Button
                type="submit"
                disabled={verifyingOtp}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl h-11 shadow-lg"
              >
                {verifyingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify Code & Create Account
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setRequiresOtp(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to Registration Details
              </Button>
            </form>
          </AuthShell>
        );
    }

    return (
      <AuthShell title="Create Your Account" subtitle="Unlock LabSense AI medical intelligence & report analysis.">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="fullName">Full Name</label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              required
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-2xl text-sm"
            />
          </div>
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
            <label className="text-xs font-semibold text-foreground" htmlFor="password">Password</label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create Account
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground font-medium">
          Already have an account?{" "}
          <Link to="/signin" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </AuthShell>
    );
}
