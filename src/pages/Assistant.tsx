import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { cloudEnabled, isLocalModeForced } from "@/lib/cloudMode";
import { getLocalReportById, getLocalReports } from "@/lib/localReports";
import { runAiConnectivityTest, type ConnectivityReport } from "@/lib/aiConnectivity";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Is my hemoglobin low?",
  "What does high WBC mean?",
  "Are my platelets normal?",
  "Should I be worried?",
];

const Assistant = () => {
  const { user, session } = useAuth();
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [diag, setDiag] = useState<ConnectivityReport | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      let r: any = null;
      let cloudOk = false;
      if (id?.startsWith("local_")) {
        r = getLocalReportById(id, user?.id);
      } else if (cloudEnabled()) {
        try {
          if (id) {
            const { data } = await supabase.from("reports").select("*").eq("id", id).eq("user_id", user?.id ?? "").maybeSingle();
            r = data;
          } else {
            const { data } = await supabase.from("reports").select("*").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(1).maybeSingle();
            r = data;
          }
          cloudOk = true;
        } catch (e) {
          console.warn("Cloud report load failed, falling back to local reports:", e);
        }
      }

      if (!r && (!cloudEnabled() || !cloudOk)) {
        r = getLocalReports(user?.id)[0] ?? null;
      }
      setReport(r);
    })();
  }, [id, user?.id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const reportContext = useMemo(() => {
    if (!report) return "";
    return `File: ${report.file_name}\nSummary: ${report.summary || "n/a"}\nValues: ${JSON.stringify(report.values || {})}\nML Prediction: ${JSON.stringify(report.prediction || {})}`;
  }, [report]);

  const buildLocalAssistantReply = (question: string): string => {
    const q = (question || "").toLowerCase();
    const values = (report?.values || {}) as Record<string, { value?: number; unit?: string; status?: string }>;
    const fmt = (name: string, key: string) => {
      const v = values[key];
      if (!v || v.value == null) return `${name}: not detected in this report.`;
      return `${name}: ${v.value} ${v.unit || ""} (${v.status || "unknown"}).`;
    };

    if (q.includes("wbc")) {
      const v = values.wbc;
      const meaning =
        v?.status === "high"
          ? "High WBC can happen with infection, inflammation, physical stress, or some medicines. It should be interpreted with symptoms and clinician advice."
          : v?.status === "low"
          ? "Low WBC can indicate reduced immune defense and should be reviewed by a clinician, especially if fever/infections are present."
          : "WBC appears in the normal range in this report.";
      return `${fmt("WBC", "wbc")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
    }

    if (q.includes("hemoglobin") || q.includes("hgb") || q.includes("hb")) {
      const v = values.hemoglobin;
      const meaning =
        v?.status === "low"
          ? "Low hemoglobin can be associated with anemia and should be reviewed with your clinician along with symptoms and other CBC parameters."
          : v?.status === "high"
          ? "High hemoglobin can occur from dehydration, smoking, high altitude exposure, or other causes and should be clinically evaluated."
          : "Hemoglobin appears in the normal range in this report.";
      return `${fmt("Hemoglobin", "hemoglobin")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
    }

    if (q.includes("platelet")) {
      const v = values.platelets;
      const meaning =
        v?.status === "high"
          ? "High platelets may be reactive (for example after inflammation or infection) or from other causes. Clinical correlation is needed."
          : v?.status === "low"
          ? "Low platelets may increase bleeding tendency and should be reviewed promptly by a clinician."
          : "Platelets appear in the normal range in this report.";
      return `${fmt("Platelets", "platelets")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
    }

    if (q.includes("hba1c") || q.includes("a1c")) {
      const v = values.hba1c;
      const meaning =
        v?.status === "high"
          ? "Higher HbA1c suggests elevated average glucose over recent months and warrants clinician review for diabetes risk."
          : "HbA1c does not appear elevated in this report.";
      return `${fmt("HbA1c", "hba1c")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
    }

    if (q.includes("rbc") || q.includes("red blood")) {
      const v = values.rbc;
      const meaning =
        v?.status === "low"
          ? "Low RBC can be associated with anemia and should be interpreted with hemoglobin, hematocrit, and clinical symptoms."
          : v?.status === "high"
          ? "High RBC can be associated with dehydration, hypoxia, or other causes and should be clinically reviewed."
          : "RBC appears in the normal range in this report.";
      return `${fmt("RBC", "rbc")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
    }

    if (q.includes("glucose") || q.includes("sugar")) {
      const v = values.glucose;
      const meaning =
        v?.status === "high"
          ? "Higher glucose may indicate impaired glucose control; correlate with fasting status and HbA1c."
          : v?.status === "low"
          ? "Low glucose can cause weakness/sweating/dizziness and should be clinically reviewed."
          : "Glucose appears in the normal range in this report.";
      return `${fmt("Glucose", "glucose")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
    }

    if (q.includes("risk") || q.includes("worried") || q.includes("overall") || q.includes("summary")) {
      const important = Object.entries(values)
        .filter(([, v]) => v?.status === "low" || v?.status === "high")
        .map(([k, v]) => `${k.toUpperCase()}: ${v?.value} ${v?.unit} (${v?.status})`);
      if (important.length === 0) {
        return "Based on the uploaded report, detected key markers are mostly within normal ranges.\n\nNot medical advice. Please confirm with your doctor.";
      }
      return `Based on the uploaded report, these markers are outside range:\n- ${important.join("\n- ")}\n\nPlease review these with your doctor for proper interpretation.`;
    }

    return [
      "AI provider is unavailable, so this answer is generated from your currently selected uploaded report:",
      fmt("Hemoglobin", "hemoglobin"),
      fmt("WBC", "wbc"),
      fmt("RBC", "rbc"),
      fmt("Platelets", "platelets"),
      fmt("Glucose", "glucose"),
      "",
      "Ask about one specific marker (WBC, platelets, HbA1c, creatinine, etc.) for a focused explanation.",
      "Not medical advice. Please confirm with your doctor.",
    ].join("\n");
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);

    try {
      if (!cloudEnabled()) {
        const fallback = "Cloud assistant is unavailable in local mode. I can still help: based on your report values, focus on any metrics marked low/high and consult your doctor for interpretation.";
        setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, reportContext }),
      });
      if (resp.status === 429) { toast.error("Rate limit reached, try again shortly."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setBusy(false); return; }
      if (!resp.ok) throw new Error("Assistant request failed");

      const contentType = resp.headers.get("content-type") || "";
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (contentType.includes("text/event-stream")) {
        if (!resp.body) throw new Error("Stream body missing");
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                acc += delta;
                setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m)));
              }
            } catch { buf = line + "\n" + buf; break; }
          }
        }
      } else {
        const body = await resp.json().catch(() => ({}));
        const raw = body?.reply || body?.message || "";
        const providerUnavailable =
          !!body?.warning ||
          /could not reach the ai provider|provider unreachable|hf gateway error/i.test(raw);
        acc = providerUnavailable ? buildLocalAssistantReply(text) : (raw || "Assistant responded with an empty message.");
        setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m)));
      }

      if (report?.id && !String(report.id).startsWith("local_")) {
        await supabase.from("chat_messages").insert([
          { report_id: report.id, user_id: user?.id, role: "user", content: text },
          { report_id: report.id, user_id: user?.id, role: "assistant", content: acc },
        ]);
      }
    } catch (e: any) {
      console.error(e);
      if (/failed to fetch/i.test(String(e?.message || "")) || isLocalModeForced()) {
        const fallback = buildLocalAssistantReply(text);
        setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
        toast.warning("Cloud chat unavailable. Showing local marker-based explanation.");
      } else {
        toast.error(e.message || "Chat failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const runDiagnostics = async () => {
    if (diagBusy) return;
    setDiagBusy(true);
    try {
      const result = await runAiConnectivityTest();
      setDiag(result);
      if (result.ok) {
        toast.success("AI connectivity test passed.");
      } else {
        toast.warning("AI connectivity test found issues. See details below.");
      }
    } catch (e: any) {
      toast.error(`Diagnostics failed: ${String(e?.message || e)}`);
    } finally {
      setDiagBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-3xl flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="h-7 w-7 text-primary" /> AI Health Assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          {report ? `Discussing: ${report.file_name}` : "Upload a report first to get personalized insights."}
        </p>
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={runDiagnostics} disabled={diagBusy}>
            {diagBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Run AI Connectivity Test
          </Button>
        </div>
      </div>

      {diag && (
        <Card className="p-4 shadow-card">
          <div className="mb-2 text-sm font-semibold">
            AI Diagnostics: {diag.ok ? "Passed" : "Issues found"}
          </div>
          <div className="space-y-2 text-sm">
            {diag.checks.map((c) => (
              <div key={c.name} className="rounded-md border p-2">
                <div className={cn("font-medium", c.ok ? "text-success" : "text-destructive")}>
                  {c.ok ? "PASS" : "FAIL"} · {c.name}
                </div>
                <div className="text-muted-foreground">{c.details}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-1 flex-col overflow-hidden shadow-card">
        <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary shadow-elevated">
                <Bot className="h-7 w-7 text-primary-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Ask me anything about your lab report.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-primary hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
              {m.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2 border-t border-border bg-background/50 p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your report..."
            disabled={busy}
          />
          <Button type="submit" disabled={busy || !input.trim()} className="bg-gradient-primary">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        ⚕️ AI insights only — not medical advice. Consult a doctor for medical decisions.
      </p>
    </div>
  );
};

export default Assistant;
