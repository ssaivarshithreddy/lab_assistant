import { Activity } from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-soft">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl gap-8 md:grid-cols-2">
          <div className="hidden rounded-2xl bg-gradient-primary p-8 text-primary-foreground shadow-elevated md:flex md:flex-col md:justify-between">
            <div>
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                <Activity className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold">LabSense</h2>
              <p className="mt-2 text-sm text-primary-foreground/90">
                Private lab insights for every user, protected by Supabase Auth and Row Level Security.
              </p>
            </div>
            <p className="text-xs text-primary-foreground/80">
              Not medical advice. Always consult a healthcare professional.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Activity className="h-4 w-4" />
              LabSense
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
