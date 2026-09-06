import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Loader2, MessageSquareHeart, Trash2, TrendingDown, TrendingUp, Download, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { MedicalReasoningCard } from "@/components/MedicalReasoningCard";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";
import { deleteLocalReport, getLocalReports } from "@/lib/localReports";
import { cn } from "@/lib/utils";

const METRICS = [
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
    normal: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    low: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    high: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function valuesFromSummary(summary) {
    if (!summary) return {};
    return METRICS.reduce((acc, metric) => {
        const names = [metric.label, metric.key];
        const namePattern = names.map(escapeRegex).join("|");
        const match = summary.match(new RegExp(`(?:${namePattern})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*([^;()]*?)\\s*\\((low|normal|high)\\)`, "i"));
        if (match) {
            acc[metric.key] = {
                value: Number(match[1]),
                unit: match[2].trim() || undefined,
                status: match[3].toLowerCase(),
            };
        }
        return acc;
    }, {});
}

function displayValues(report) {
    const merged = valuesFromSummary(report.summary);
    let reportVals = report.values;
    if (typeof reportVals === 'string') {
        try { reportVals = JSON.parse(reportVals); } catch(e) {}
    }
    Object.entries(reportVals ?? {}).forEach(([key, value]) => {
        if (value?.value != null) merged[key] = value;
    });
    return merged;
}

function isLocalReport(report) {
    return report.local_only === true || String(report.id).startsWith("local_");
}

const Dashboard = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        (async () => {
            setLoading(true);
            let cloudRows = [];
            let cloudOk = false;
            try {
                const data = await apiClient.getReports();
                cloudRows = data || [];
                cloudOk = true;
            } catch (e) {
                console.warn("Backend reports unavailable, using local cache:", e.message);
            }

            const rows = cloudOk
                ? cloudRows
                : getLocalReports(user?.id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

            setReports(rows);
            if (!id && rows[0]) {
                navigate(`/dashboard/${rows[0].id}`, { replace: true });
            }
            setLoading(false);
        })();
    }, [id, navigate, user?.id]);

    const current = useMemo(() => reports.find((r) => String(r.id) === String(id)) ?? reports[0], [reports, id]);

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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 py-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl bg-card border border-border" />
            ))}
          </div>
        );
    }

    if (!current) {
        return (
          <Card className="mx-auto max-w-md p-10 text-center glass-card rounded-3xl space-y-4 my-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto glow-indigo">
              <FileText className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">No Reports Yet</CardTitle>
            <p className="text-sm text-muted-foreground">Upload your first lab report to unlock AI diagnostic insights and trend analytics.</p>
            <Button asChild size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg glow-indigo">
              <Link to="/">Upload Lab Report</Link>
            </Button>
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
            if (isLocalReport(current)) {
                deleteLocalReport(current.id, user?.id);
            } else {
                await apiClient.deleteReport(current.id);
            }
            const remaining = reports.filter((r) => r.id !== current.id);
            setReports(remaining);
            toast.success("Report removed.");
            if (remaining[0]) {
                navigate(`/dashboard/${remaining[0].id}`, { replace: true });
            } else {
                navigate("/dashboard", { replace: true });
            }
        } catch (err) {
            toast.error(err.message || "Failed to delete report.");
        } finally {
            setDeleting(false);
        }
    };

    return (
      <div className="space-y-8 py-2">
        {/* Dashboard Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-2">
              <Activity className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" /> LabSense Diagnostic Portal
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Health Dashboard</h1>
            <p className="text-sm text-muted-foreground">Clinical metrics, AI diagnostic insights, and multi-report health trends.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {current && (
              <Button asChild className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold rounded-2xl shadow-lg glow-indigo">
                <Link to={`/assistant/${current.id}`} className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Ask AI Assistant
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="border-border bg-card text-foreground hover:bg-muted rounded-2xl">
              <Link to="/">Upload New Report</Link>
            </Button>
            {current && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="border-border bg-card text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/40 rounded-2xl">
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border text-foreground rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-foreground">Delete Report?</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                      This will remove <strong className="text-foreground">{current.file_name}</strong> from your dashboard and MinIO storage.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-muted text-muted-foreground rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteCurrentReport} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin"/> : "Delete Report"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Report Selector Pills */}
        {reports.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Select Report:</span>
            {reports.map((r) => (
              <Button
                key={r.id}
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-2xl text-xs font-semibold px-4 py-2 transition-all whitespace-nowrap border",
                  r.id === current.id
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md glow-indigo"
                    : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
                onClick={() => navigate(`/dashboard/${r.id}`)}
              >
                {r.file_name}
              </Button>
            ))}
          </div>
        )}

        {/* Top 3 Metric Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          <Card className="glass-card rounded-3xl p-6 border-border">
            <CardHeader className="flex flex-row items-center justify-between p-0 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Document</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-lg font-bold text-foreground truncate">{current.file_name}</div>
              <p className="text-xs font-medium text-muted-foreground mt-1">{new Date(current.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>

          <Card className="glass-card rounded-3xl p-6 border-border">
            <CardHeader className="flex flex-row items-center justify-between p-0 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Extracted Metrics</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-3xl font-extrabold text-foreground">{detectedMetricCount}</div>
              <p className="text-xs font-medium text-muted-foreground mt-1">Clinical parameters identified</p>
            </CardContent>
          </Card>

          <Card className="glass-card rounded-3xl p-6 border-border">
            <CardHeader className="flex flex-row items-center justify-between p-0 pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attention Required</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-3xl font-extrabold text-foreground">{abnormalCount}</div>
              <p className="text-xs font-medium text-muted-foreground mt-1">Out-of-reference parameters</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Summary Card */}
        {current.summary && (
          <Card className="glass-card rounded-3xl p-6 border-indigo-500/20 bg-gradient-to-r from-card via-card to-indigo-500/10">
            <CardHeader className="flex flex-row items-center justify-between p-0 pb-4">
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> LabSense AI Findings & Summary
              </CardTitle>
              <Button asChild variant="outline" size="sm" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 rounded-xl text-xs font-bold">
                <Link to={`/assistant/${current.id}`} className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-300" />
                  Chat with AI Assistant
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line font-medium">{current.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Clinical Medical Reasoning Chain Card */}
        <MedicalReasoningCard values={values} summary={current.summary} medicalReasoning={current.medical_reasoning} />

        {/* Extracted Test Parameters Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            Extracted Clinical Test Parameters
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((metric) => {
              const item = values[metric.key];
              if (!item || item.value == null) return null;
              return (
                <Card key={metric.key} className="glass-card rounded-2xl p-5 border-border space-y-3 hover:border-indigo-500/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">{metric.label}</span>
                    <Badge variant="outline" className={cn("capitalize text-[11px] font-bold px-2.5 py-0.5 rounded-full border", statusStyle[item.status] || statusStyle.normal)}>
                      {item.status || "normal"}
                    </Badge>
                  </div>
                  <div className="text-3xl font-extrabold text-foreground">
                    {item.value} <span className="text-sm font-normal text-muted-foreground">{item.unit || ""}</span>
                  </div>
                  {item.range && (
                    <p className="text-xs text-muted-foreground font-medium">Ref Range: {item.range}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Metric Trends Graph */}
        {trendData.length > 1 && (
          <Card className="glass-card rounded-3xl p-6 border-border">
            <CardHeader className="p-0 pb-6">
              <CardTitle className="text-lg font-bold text-foreground">Metric Trends Across Reports</CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "1rem", color: "hsl(var(--foreground))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="hemoglobin" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} name="Hemoglobin" />
                  <Line type="monotone" dataKey="wbc" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="WBC" />
                  <Line type="monotone" dataKey="platelets" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Platelets" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <MedicalDisclaimer/>
      </div>
    );
};

export default Dashboard;
