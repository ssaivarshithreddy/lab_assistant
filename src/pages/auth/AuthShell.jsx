import { Activity, Sparkles, ShieldCheck, Sun, Moon, Monitor } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AuthShell({ title, subtitle, children }) {
    const { theme, setTheme } = useTheme();

    return (
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-indigo-500/30 flex flex-col items-center justify-center p-4 relative transition-colors duration-300">
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

        <div className="mx-auto flex w-full max-w-5xl items-center justify-center py-6">
          <div className="grid w-full max-w-4xl gap-8 md:grid-cols-2">
            {/* Left Banner */}
            <div className="hidden rounded-3xl bg-gradient-to-tr from-indigo-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-8 text-white shadow-2xl glow-indigo md:flex md:flex-col md:justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
              <div>
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg">
                  <Activity className="h-6 w-6" />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-3">
                  <Sparkles className="h-3.5 w-3.5" /> LabSense Clinical AI
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white">LabSense AI</h2>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed font-medium">
                  Instant clinical lab report analysis, automated ML risk prediction, and Groq-powered AI diagnostic assistance.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-300 font-semibold">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> PostgreSQL & MinIO Secured
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Automated Parameter Extraction
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" /> Role-Based Access Controls
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-medium border-t border-slate-800/80 pt-4">
                ⚕️ Information provided is for educational reference. Always consult a physician.
              </p>
            </div>

            {/* Right Form Container */}
            <div className="glass-card rounded-3xl border border-border p-8 shadow-2xl">
              <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">
                <Activity className="h-4 w-4 text-indigo-500" />
                LabSense Home
              </Link>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1.5 text-xs text-muted-foreground font-medium">{subtitle}</p>
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </div>
      </div>
    );
}
