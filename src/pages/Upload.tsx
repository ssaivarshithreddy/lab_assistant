import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud, FileText, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { extractTextFromFile } from "@/lib/extractText";
import { analyzeReport } from "@/lib/analyzeReport";
import { predictRisk } from "@/lib/predictRisk";
import { createLocalReport } from "@/lib/localReports";
import { cloudEnabled } from "@/lib/cloudMode";
import { cn } from "@/lib/utils";

const Upload = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
      toast.error("Please upload a PDF or image file.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB).");
      return;
    }
    setFile(f);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setStage("Extracting text (OCR/text extraction)...");
      setProgress(5);

      // Start upload in parallel to save wall clock time; we'll await its completion before saving report.
      if (!user) throw new Error("You must be signed in to analyze reports.");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
      const useCloud = cloudEnabled();
      const uploadPromise = useCloud ? supabase.storage.from("lab-reports").upload(path, file) : null;

      // Extract text (may be CPU-heavy). Progress updates come from extractTextFromFile.
      const rawText = await extractTextFromFile(file, (m) => {
        setStage(m);
      });

      setProgress(55);
      setStage("Analyzing with ClinicalBERT...");

      // ── Run analysis locally (no Edge Function needed) ──
      const ai = await analyzeReport(rawText, file.name);
      console.log("ClinicalBERT analyze-report response:", ai);

      setStage("Running ML risk prediction...");
      setProgress(75);

      // ── Run risk prediction locally ──
      const ml = predictRisk(ai.values as any);
      console.log("ML predict-risk response:", ml);

      if (!useCloud) {
        const localReport = createLocalReport({
          file_name: file.name,
          file_path: path,
          raw_text: rawText,
          values: (ml?.enriched_values ?? ai.values ?? {}) as any,
          summary: ai.summary ?? "",
          prediction: { ...(ml ?? {}), ai_engine: ai.ai_engine ?? null } as any,
        }, user.id);
        setProgress(100);
        toast.success("Report analyzed in local mode.");
        navigate(`/dashboard/${localReport.id}`);
        return;
      }

      // Ensure upload finished (or surface upload error)
      setStage("Uploading file to storage...");
      setProgress(85);
      const { error: upErr } = await uploadPromise!;
      let cloudFilePath: string | null = path;
      if (upErr) {
        console.error("Upload error:", upErr);
        cloudFilePath = null;
        toast.warning("Storage upload failed. Saving report in cloud DB without file attachment.");
      }

      setStage("Saving report metadata...");
      setProgress(92);
      const { data: report, error: insErr } = await supabase
        .from("reports")
        .insert({
          file_name: file.name,
          user_id: user.id,
          file_path: cloudFilePath,
          raw_text: rawText,
          values: (ml?.enriched_values ?? ai.values ?? {}) as any,
          summary: ai.summary ?? "",
          prediction: { ...(ml ?? {}), ai_engine: ai.ai_engine ?? null } as any,
        })
        .select()
        .single();
      if (insErr) {
        console.error("Insert error:", insErr);
        const localReport = createLocalReport({
          file_name: file.name,
          file_path: path,
          raw_text: rawText,
          values: (ml?.enriched_values ?? ai.values ?? {}) as any,
          summary: ai.summary ?? "",
          prediction: { ...(ml ?? {}), ai_engine: ai.ai_engine ?? null } as any,
        }, user.id);
        toast.warning("Cloud database unavailable. Report saved locally in this browser.");
        navigate(`/dashboard/${localReport.id}`);
        return;
      }

      if (cloudFilePath === null) {
        toast.warning("Report saved to cloud DB, but file upload failed. Check Supabase Storage bucket/policies.");
      }

      setProgress(100);
      toast.success("Report analyzed!");
      navigate(`/dashboard/${report.id}`);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || "");
      if (/failed to fetch/i.test(msg)) {
        toast.error("Network request failed. Check internet/Supabase connection and try again.");
      } else {
        toast.error(e.message || "Something went wrong");
      }
    } finally {
      setBusy(false);
      setStage("");
      setProgress(0);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Upload your lab report</h1>
        <p className="text-muted-foreground">
          PDF or image. We'll extract values and explain them in plain English.
        </p>
      </div>

      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "relative cursor-pointer border-2 border-dashed p-10 text-center transition-colors",
          dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50"
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
          <div className="flex flex-col items-center gap-3">
            {previewUrl ? (
              <img src={previewUrl} alt="preview" className="max-h-48 rounded-md shadow-card" />
            ) : (
              <FileText className="h-14 w-14 text-primary" />
            )}
            <div>
              <div className="font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-elevated">
              <UploadCloud className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <div className="font-medium">Drag & drop your report here</div>
              <div className="text-sm text-muted-foreground">or click to browse — PDF, PNG, JPG</div>
            </div>
          </div>
        )}
      </Card>

      {busy && (
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{stage}</span>
          </div>
          <Progress value={progress} />
        </Card>
      )}

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" onClick={analyze} disabled={!file || busy} className="bg-gradient-primary px-8 shadow-elevated">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Analyze report
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Processed securely. Not medical advice.
        </p>
      </div>
    </div>
  );
};

export default Upload;
