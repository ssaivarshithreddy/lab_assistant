import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Loader2, MessageSquareHeart, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { cloudEnabled } from "@/lib/cloudMode";
import { deleteLocalReport, getLocalReports } from "@/lib/localReports";
import { cn } from "@/lib/utils";
import type { ValueObj, ReportData } from "@/types/report";

const METRICS: { key: string; label: string }[] = [
  { key: "hemoglobin", label: "Hemoglobin" },
  { key: "wbc", label: "WBC" },
  { key: "rbc", label: "RBC" },
  { key: "platelets", label: "Platelets" },
  { key: "glucose", label: "Glucose" },
  { key: "hematocrit", label: "Hematocrit" },
  { key: "mcv", label: "MCV" },
  { key: "mch", label: "MCH" },
  { key: "mchc", label: "MCHC" },
  { key: "neutrophils", label: "Neutrophils" },
  { key: "lymphocytes", label: "Lymphocytes" },
  { key: "monocytes", label: "Monocytes" },
  { key: "eosinophils", label: "Eosinophils" },
  { key: "basophils", label: "Basophils" },
  { key: "creatinine", label: "Creatinine" },
  { key: "urea", label: "Urea" },
  { key: "bun", label: "BUN" },
  { key: "sodium", label: "Sodium" },
  { key: "potassium", label: "Potassium" },
  { key: "chloride", label: "Chloride" },
  { key: "calcium", label: "Calcium" },
  { key: "bilirubin", label: "Bilirubin" },
  { key: "ast", label: "AST" },
  { key: "alt", label: "ALT" },
  { key: "alp", label: "ALP" },
  { key: "crp", label: "CRP" },
  { key: "hba1c", label: "HbA1c" },
];

const statusStyle = {
  normal: "bg-success-soft text-success border-success/20",
  low: "bg-destructive-soft text-destructive border-destructive/20",
  high: "bg-destructive-soft text-destructive border-destructive/20",
} as const;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function valuesFromSummary(summary: string | null | undefined): Record<string, ValueObj> {
  if (!summary) return {};

  return METRICS.reduce<Record<string, ValueObj>>((acc, metric) => {
    const names = [metric.label, metric.key];
    const namePattern = names.map(escapeRegex).join("|");
    const match = summary.match(
      new RegExp(`(?:${namePattern})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*([^;()]*?)\\s*\\((low|normal|high)\\)`, "i")
    );

    if (match) {
      acc[metric.key] = {
        value: Number(match[1]),
        unit: match[2].trim() || undefined,
        status: match[3].toLowerCase() as ValueObj["status"],
      };
    }

    return acc;
  }, {});
}

function displayValues(report: Pick<ReportData, "summary" | "values">): Record<string, ValueObj> {
  const merged = valuesFromSummary(report.summary);

  Object.entries(report.values ?? {}).forEach(([key, value]) => {
    if (value?.value != null) merged[key] = value;
  });

  return merged;
}

function isLocalReport(report: ReportData): boolean {
  return report.local_only === true || report.id.startsWith("local_");
}

const Dashboard = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let cloudRows: ReportData[] = [];
      let cloudOk = false;
      if (cloudEnabled()) {
        try {
          const { data, error } = await supabase
            .from("reports")
            .select("*")
            .eq("user_id", user?.id ?? "")
            .order("created_at", { ascending: false });
          if (error) throw error;
          cloudRows = (data ?? []) as ReportData[];
          cloudOk = true;
        } catch (e) {
          console.warn("Cloud reports unavailable, using local reports only:", e);
        }
      }

      // Use local cache only when cloud is unavailable.
      const rows = cloudOk
        ? cloudRows
        : (getLocalReports(user?.id) as unknown as ReportData[]).sort(
            (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
          );

      setReports(rows);
      if (!id && rows[0]) navigate(`/dashboard/${rows[0].id}`, { replace: true });
      setLoading(false);
    })();
  }, [id, navigate, user?.id]);

  const current = useMemo(() => reports.find((r) => r.id === id) ?? reports[0], [reports, id]);

  const trendData = useMemo(() => {
    return [...reports]
      .reverse()
      .map((r) => {
        const v = displayValues(r);
        return {
          date: new Date(r.created_at).toLocaleDateString(),
          hemoglobin: v.hemoglobin?.value,
          wbc: v.wbc?.value,
          rbc: v.rbc?.value,
          platelets: v.platelets?.value,
        };
      });
  }, [reports]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!current) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <CardTitle className="mb-2">No reports yet</CardTitle>
        <p className="mb-4 text-sm text-muted-foreground">Upload your first lab report to see results here.</p>
        <Button asChild className="bg-gradient-primary"><Link to="/">Upload report</Link></Button>
      </Card>
    );
  }

  const values = displayValues(current);
  const detectedMetricCount = METRICS.filter((m) => values[m.key]?.value != null).length;
  const abnormalCount = METRICS.filter((m) => {
    const s = values[m.key]?.status;
    return s === "low" || s === "high";
  }).length;

  const deleteCurrentReport = async () => {
    if (!current || deleting) return;

    setDeleting(true);
    try {
      if (isLocalReport(current) || !cloudEnabled()) {
        deleteLocalReport(current.id, user?.id);
      } else {
        if (current.file_path) {
          const { error: storageError } = await supabase.storage.from("lab-reports").remove([current.file_path]);
          if (storageError) console.warn("Storage file delete failed; deleting report row anyway:", storageError);
        }

        const { error } = await supabase
          .from("reports")
          .delete()
          .eq("id", current.id)
          .eq("user_id", user?.id ?? "");
        if (error) throw error;
      }

      const remaining = reports.filter((r) => r.id !== current.id);
      setReports(remaining);
      toast.success("Report removed.");

      if (remaining[0]) {
        navigate(`/dashboard/${remaining[0].id}`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error("Delete report failed:", error);
      toast.error("Could not remove this report. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {current.file_name} · {new Date(current.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-gradient-primary">
            <Link to={`/assistant/${current.id}`}>
              <MessageSquareHeart className="mr-2 h-4 w-4" /> Ask the AI assistant
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive-soft" disabled={deleting}>
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Remove report
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this report?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the uploaded file attachment when available and deletes this report from your dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                  onClick={() => void deleteCurrentReport()}
                >
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {reports.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {reports.map((r) => (
            <Link
              key={r.id}
              to={`/dashboard/${r.id}`}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-xs",
                r.id === current.id ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-muted"
              )}
            >
              {new Date(r.created_at).toLocaleDateString()}
            </Link>
          ))}
        </div>
      )}

      {detectedMetricCount > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m) => {
            const v = values[m.key];
            const status = v?.status ?? "normal";
            const Icon = status === "high" ? TrendingUp : status === "low" ? TrendingDown : CheckCircle2;
            return (
              <Card key={m.key} className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    {m.label}
                    <Activity className="h-4 w-4" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {v?.value != null ? (
                    <>
                      <div className="text-2xl font-bold">
                        {v.value} <span className="text-sm font-normal text-muted-foreground">{v.unit}</span>
                      </div>
                      <Badge variant="outline" className={cn("mt-2 capitalize", statusStyle[status])}>
                        <Icon className="mr-1 h-3 w-3" /> {status}
                      </Badge>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Not detected</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Activity className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">General health report analyzed</div>
                <p className="text-sm text-muted-foreground">
                  No standard lab metric cards were detected, so the result is summarized from the report text below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <MedicalDisclaimer />

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>ClinicalBERT status</CardTitle>
        </CardHeader>
        <CardContent>
          {current.prediction?.ai_engine ? (
            <div className="text-sm">
              <div className="font-medium">
                {current.prediction.ai_engine.clinicalbert_used ? "ClinicalBERT enrichment active" : "Regex-only fallback used"}
              </div>
              <div className="text-muted-foreground">
                Source: {current.prediction.ai_engine.source || "unknown"} · Entities: {current.prediction.ai_engine.entities_detected ?? 0}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No AI engine metadata available for this report.</div>
          )}
        </CardContent>
      </Card>

      {current.prediction?.risk_level && (
        <Card className={cn(
          "shadow-elevated border-2",
          current.prediction.risk_level === "Normal" && "border-success/40 bg-success-soft",
          current.prediction.risk_level === "Mild Risk" && "border-warning/50 bg-warning/10",
          current.prediction.risk_level === "High Risk" && "border-destructive/50 bg-destructive-soft",
        )}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {current.prediction.risk_level === "Normal" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertTriangle className={cn("h-5 w-5", current.prediction.risk_level === "High Risk" ? "text-destructive" : "text-warning")} />}
                ML Risk Prediction
              </span>
              <Badge className={cn(
                "text-sm",
                current.prediction.risk_level === "Normal" && "bg-success text-success-foreground",
                current.prediction.risk_level === "Mild Risk" && "bg-warning text-warning-foreground",
                current.prediction.risk_level === "High Risk" && "bg-destructive text-destructive-foreground",
              )}>
                {current.prediction.risk_level}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.prediction.insights && current.prediction.insights.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {current.prediction.insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No abnormal patterns detected by the ML model.</p>
            )}
            {typeof current.prediction.confidence === "number" && (
              <p className="text-xs text-muted-foreground">
                Model confidence: {(current.prediction.confidence * 100).toFixed(0)}% · This is not medical advice.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground">{current.summary || "No summary available."}</p>
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
              ⚠️ This is not medical advice. Please consult a doctor for medical decisions.
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {abnormalCount > 0 ? <AlertTriangle className="h-5 w-5 text-warning" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
              Risk indicators
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detectedMetricCount === 0 ? (
              <p className="text-sm text-muted-foreground">No standard lab risk indicators were detected. Review the AI summary for report findings.</p>
            ) : abnormalCount === 0 ? (
              <p className="text-sm text-muted-foreground">All detected values are within normal range.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {METRICS.filter((m) => ["low", "high"].includes(values[m.key]?.status ?? "")).map((m) => (
                  <li key={m.key} className="flex items-center justify-between rounded-md bg-destructive-soft px-3 py-2">
                    <span>{m.label}</span>
                    <span className="font-medium capitalize text-destructive">{values[m.key]?.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-3 px-0">
              <Link to={`/assistant/${current.id}`}>Explain to me <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {trendData.length > 1 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Trends across reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="hemoglobin" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="wbc" stroke="hsl(var(--success))" strokeWidth={2} />
                  <Line type="monotone" dataKey="rbc" stroke="hsl(var(--warning))" strokeWidth={2} />
                  <Line type="monotone" dataKey="platelets" stroke="hsl(var(--destructive))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
