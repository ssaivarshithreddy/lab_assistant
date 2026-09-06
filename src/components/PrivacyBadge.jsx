import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PrivacyBadge({ className, variant = "default" }) {
  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30", className)}>
        <Lock className="h-3.5 w-3.5" />
        <span>AES-256 Encrypted & Private</span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/30 text-xs shadow-xs", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-foreground flex items-center gap-1.5">
            End-to-End Encrypted Medical Privacy
            <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
              AES-256-GCM
            </span>
          </div>
          <div className="text-muted-foreground font-medium text-[11px] mt-0.5">
            Your uploaded lab reports, extracted metrics, and AI health assistant chats are encrypted at rest with military-grade AES-256 security.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" /> HIPAA Compliant Architecture
      </div>
    </div>
  );
}
