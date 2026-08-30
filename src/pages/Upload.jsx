import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/features/auth/AuthProvider";
import { extractTextFromFile } from "@/lib/extractText";
import { analyzeReport } from "@/lib/analyzeReport";
import { predictRisk } from "@/lib/predictRisk";
import { createLocalReport } from "@/lib/localReports";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

function mergeAnalysisValues(analysisValues, enrichedValues) {
    const merged = {};
    Object.entries(analysisValues ?? {}).forEach(([key, value]) => {
        if (value?.value != null)
            merged[key] = value;
    });
    Object.entries(enrichedValues ?? {}).forEach(([key, value]) => {
        if (value?.value != null)
            merged[key] = value;
    });
    return merged;
}

const Upload = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [busy, setBusy] = useState(false);
    const [stage, setStage] = useState("");
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = useCallback((f) => {
        if (!f) return;
        if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
            toast.error("Please upload a PDF or image file.");
            return;
        }
        if (f.size > 15 * 1024 * 1024) {
            toast.error("File too large (max 15 MB).");
            return;
        }
        setFile(f);
        setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
    }, []);

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files?.[0] ?? null);
    };

    const analyze = async () => {
        if (!file) return;
        setBusy(true);
        try {
            setStage("Extracting text (OCR/text extraction)...");
            setProgress(15);
            if (!user) throw new Error("You must be signed in to analyze reports.");

            const rawText = await extractTextFromFile(file, (m) => {
                setStage(m);
            });
            setProgress(55);
            setStage("Analyzing medical terms & metrics...");

            const ai = await analyzeReport(rawText, file.name);
            setStage("Running ML risk prediction...");
            setProgress(75);

            const ml = predictRisk(ai.values);
            const reportValues = mergeAnalysisValues(ai.values, ml?.enriched_values);
            const hasLabValues = Object.values(reportValues).some((value) => value?.value != null);
            const reportPrediction = hasLabValues
                ? { ...ml, ai_engine: ai.ai_engine ?? undefined }
                : {
                    risk_level: ai.risks.length > 0 ? "Mild Risk" : "Normal",
                    abnormal_parameters: [],
                    insights: ai.risks.length > 0 ? ai.risks : ["Health report analyzed. No standard lab metrics were detected."],
                    score: 0,
                    confidence: 0.65,
                    disclaimer: "This is not medical advice.",
                    ai_engine: ai.ai_engine ?? undefined,
                };

            setStage("Uploading file to MinIO & saving report...");
            setProgress(85);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("file_name", file.name);
            formData.append("raw_text", rawText || "");
            formData.append("values", JSON.stringify(reportValues));
            formData.append("summary", ai.summary || "");

            let report = null;
            try {
                report = await apiClient.createReport(formData);
            } catch (err) {
                console.warn("Backend save failed, fallback to local storage:", err.message);
                report = createLocalReport({
                    file_name: file.name,
                    file_path: file.name,
                    raw_text: rawText,
                    values: reportValues,
                    summary: ai.summary ?? "",
                    prediction: reportPrediction,
                }, user.id);
            }

            setProgress(100);
            toast.success("Report analyzed successfully!");
            navigate(`/dashboard/${report.id}`);
        } catch (e) {
            console.error(e);
            const message = e instanceof Error ? e.message : "Something went wrong";
            toast.error(message);
        } finally {
            setBusy(false);
            setStage("");
            setProgress(0);
        }
    };

    return (
      <div className="mx-auto max-w-3xl space-y-8 py-4">
        {/* Freud UI Title Section */}
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" /> Freud AI Medical Intelligence
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Upload Your Health Report
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto">
            Upload PDF or image lab reports. Our Clinical AI engine extracts parameters and provides instant medical insights.
          </p>
        </div>

        {/* Freud UI Glassmorphic Dropzone Card */}
        <Card
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "relative cursor-pointer border-2 border-dashed p-12 text-center transition-all duration-300 rounded-3xl freud-card",
            dragOver
              ? "border-indigo-500 bg-indigo-500/10 freud-glow-indigo scale-[1.01]"
              : "border-border hover:border-indigo-500/50 hover:bg-accent/40"
          )}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-200">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="max-h-52 rounded-2xl border border-border shadow-2xl" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30 freud-glow-indigo">
                  <FileText className="h-10 w-10" />
                </div>
              )}
              <div>
                <div className="font-bold text-lg text-foreground flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                  {file.name}
                </div>
                <div className="text-xs font-semibold text-muted-foreground mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Analysis
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl freud-glow-indigo">
                <UploadCloud className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-lg text-foreground">
                  Drag & drop your lab report here
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  Supports PDF, PNG, JPG files up to 15 MB
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Progress Display */}
        {busy && (
          <Card className="space-y-3 p-6 freud-card border-indigo-500/30 rounded-2xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                {stage}
              </span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-muted rounded-full" />
          </Card>
        )}

        {/* Submit Action */}
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            onClick={analyze}
            disabled={!file || busy}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-500 hover:to-pink-400 text-white font-bold text-base px-10 py-6 rounded-2xl shadow-xl freud-glow-indigo disabled:opacity-50 transition-all"
          >
            {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Analyze Report with Freud AI
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Processed with End-to-End Privacy. Not medical advice.
          </p>
        </div>
      </div>
    );
};

export default Upload;
