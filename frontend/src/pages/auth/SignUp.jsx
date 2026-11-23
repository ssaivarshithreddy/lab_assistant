import { useState } from "react";
import { Eye, EyeOff, Loader2, UserPlus, ShieldCheck, UserRound, Stethoscope, FlaskConical, Building2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/pages/auth/AuthShell";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";

function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignUp() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState("user");
    const [loading, setLoading] = useState(false);

    const accountRoles = [
      { value: "user", label: "Normal user", description: "Personal health reports", icon: UserRound },
      { value: "doctor", label: "Doctor", description: "Clinical review workspace", icon: Stethoscope },
      { value: "lab_technician", label: "Lab technician", description: "Report processing workflow", icon: FlaskConical },
      { value: "hospital", label: "Hospital", description: "Organization-level access", icon: Building2 },
    ];

    // Optional Two-Factor Passcode setup on registration
    const [enablePasscode2FA, setEnablePasscode2FA] = useState(false);
    const [passcode, setPasscode] = useState("");

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
        if (enablePasscode2FA && (!passcode || passcode.trim().length < 4)) {
            toast.error("Security Passcode (PIN) must be between 4 and 6 digits.");
            return;
        }

        setLoading(true);
        try {
            const res = await apiClient.signUp({
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                phone_number: phoneNumber.trim() || null,
                password,
                role,
                passcode: enablePasscode2FA ? passcode.trim() : null,
            });

            if (res?.token && res?.user) {
                login(res.token, res.user);
                toast.success(res.message || "Account created successfully!");
                navigate("/", { replace: true });
            } else {
                toast.error(res?.error || "Registration failed. Please try again.");
            }
        } catch (err) {
            toast.error(err.message || "Failed to create account");
        } finally {
            setLoading(false);
        }
    }

    return (
      <AuthShell title="Create Your Account" subtitle="Unlock LabSense AI medical intelligence & report analysis." role={role}>
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

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-foreground">Account role</legend>
            <div className="grid grid-cols-2 gap-2">
              {accountRoles.map((option) => {
                const Icon = option.icon;
                const selected = role === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    aria-pressed={selected}
                    className={`flex min-h-[74px] items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="block text-xs font-bold">{option.label}</span>
                      <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Optional Two-Factor Passcode Setup */}
          <div className="rounded-2xl border border-border/80 bg-muted/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-semibold text-foreground">Two-Factor Passcode (2FA)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePasscode2FA}
                  onChange={(e) => setEnablePasscode2FA(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {enablePasscode2FA && (
              <div className="space-y-1 pt-1 animate-in fade-in-50 duration-200">
                <label className="text-[11px] font-medium text-muted-foreground" htmlFor="passcode">
                  Set 4-to-6 Digit Security PIN
                </label>
                <Input
                  id="passcode"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 123456"
                  required={enablePasscode2FA}
                  className="bg-background border-border text-foreground text-center font-mono tracking-widest rounded-xl text-sm h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  You will enter this PIN every time you sign in. (No email OTP required)
                </p>
              </div>
            )}
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
