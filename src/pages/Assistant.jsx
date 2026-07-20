import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { cloudEnabled } from "@/lib/cloudMode";
import { getLocalReportById, getLocalReports } from "@/lib/localReports";
import { runAiConnectivityTest } from "@/lib/aiConnectivity";
import { streamGroqChat, validateMessage } from "@/lib/groqService";
import { cn } from "@/lib/utils";
const SUGGESTIONS = [
    "Summarize this report",
    "What are the key findings?",
    "Is my hemoglobin low?",
    "Should I be worried?",
];
const Assistant = () => {
    const { user } = useAuth();
    const { id } = useParams();
    const [report, setReport] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [diagBusy, setDiagBusy] = useState(false);
    const [diag, setDiag] = useState(null);
    const scrollerRef = useRef(null);
    useEffect(() => {
        (async () => {
            let r = null;
            let cloudOk = false;
            if (id?.startsWith("local_")) {
                r = getLocalReportById(id, user?.id);
            }
            else if (cloudEnabled()) {
                try {
                    if (id) {
                        const { data } = await supabase.from("reports").select("*").eq("id", id).eq("user_id", user?.id ?? "").maybeSingle();
                        r = data;
                    }
                    else {
                        const { data } = await supabase.from("reports").select("*").eq("user_id", user?.id ?? "").order("created_at", { ascending: false }).limit(1).maybeSingle();
                        r = data;
                    }
                    cloudOk = true;
                }
                catch (e) {
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
    /**
     * Build a fallback response based on local metrics when Groq is unavailable
     */
    const buildLocalAssistantReply = (question) => {
        const q = (question || "").toLowerCase();
        const values = (report?.values || {});
        const hasMetrics = Object.values(values).some((v) => v?.value != null);
        const summary = report?.summary || "No summary available.";
        const fmt = (name, key) => {
            const v = values[key];
            if (!v || v.value == null)
                return `${name}: not detected in this report.`;
            return `${name}: ${v.value} ${v.unit || ""} (${v.status || "unknown"}).`;
        };
        if (!hasMetrics) {
            return [
                "Based on the uploaded health report:",
                summary,
                "",
                "I did not detect standard lab values in this file, so the answer is based on the report text rather than lab reference ranges.",
                "Not medical advice. Please confirm with your doctor.",
            ].join("\n");
        }
        // Quick responses for common questions
        if (q.includes("wbc")) {
            const v = values.wbc;
            const meaning = v?.status === "high"
                ? "High WBC can happen with infection, inflammation, or physical stress. It should be interpreted with clinical context."
                : v?.status === "low"
                    ? "Low WBC can indicate reduced immune defense and should be reviewed by a clinician."
                    : "WBC appears in the normal range in this report.";
            return `${fmt("WBC", "wbc")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
        }
        if (q.includes("hemoglobin") || q.includes("hgb") || q.includes("hb")) {
            const v = values.hemoglobin;
            const meaning = v?.status === "low"
                ? "Low hemoglobin can be associated with anemia and should be reviewed with your clinician."
                : v?.status === "high"
                    ? "High hemoglobin can occur from dehydration or other causes and should be clinically evaluated."
                    : "Hemoglobin appears in the normal range.";
            return `${fmt("Hemoglobin", "hemoglobin")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
        }
        if (q.includes("platelet")) {
            const v = values.platelets;
            const meaning = v?.status === "high"
                ? "High platelets may be reactive or from other causes requiring clinical correlation."
                : v?.status === "low"
                    ? "Low platelets may increase bleeding tendency and should be reviewed by a clinician."
                    : "Platelets appear in the normal range.";
            return `${fmt("Platelets", "platelets")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
        }
        if (q.includes("risk") || q.includes("worried") || q.includes("overall")) {
            const abnormal = Object.entries(values)
                .filter(([, v]) => v?.status === "low" || v?.status === "high")
                .map(([k, v]) => `${k}: ${v?.value} ${v?.unit} (${v?.status})`);
            if (abnormal.length === 0) {
                return "Based on your report, detected markers are mostly within normal ranges. Great news! Still, please confirm with your doctor.";
            }
            return `Markers outside normal range:\n- ${abnormal.join("\n- ")}\n\nPlease review these with your doctor.`;
        }
        return [
            "Based on your report:",
            fmt("Hemoglobin", "hemoglobin"),
            fmt("WBC", "wbc"),
            fmt("RBC", "rbc"),
            fmt("Platelets", "platelets"),
            "",
            "Ask about a specific marker for more details.",
            "Not medical advice. Please confirm with your doctor.",
        ].join("\n");
    };
    /**
     * Send message using Groq AI with streaming
     */
    const send = async (text) => {
        if (!text.trim() || busy)
            return;
        // Validate message for injection attempts
        if (!validateMessage(text)) {
            toast.error("Message contains invalid content");
            return;
        }
        setInput("");
        const userMsg = { role: "user", content: text };
        const next = [...messages, userMsg];
        setMessages(next);
        setBusy(true);
        try {
            const values = (report?.values || {});
            const summary = report?.summary || "No summary available";
            // Try Groq AI first
            if (import.meta.env.VITE_GROQ_API_KEY) {
                try {
                    let assistantContent = "";
                    const chatMessages = messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    }));
                    await streamGroqChat({
                        messages: chatMessages,
                        metricsContext: values,
                        reportSummary: summary,
                        temperature: 0.7,
                        maxTokens: 1024,
                        onChunk: (chunk) => {
                            assistantContent += chunk;
                            setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                        },
                    });
                    setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: assistantContent }]);
                    // Save to database if cloud-enabled
                    if (report?.id && !String(report.id).startsWith("local_") && cloudEnabled()) {
                        try {
                            await supabase.from("chat_messages").insert([
                                { report_id: report.id, user_id: user?.id, role: "user", content: text },
                                {
                                    report_id: report.id,
                                    user_id: user?.id,
                                    role: "assistant",
                                    content: assistantContent,
                                },
                            ]);
                        }
                        catch (dbErr) {
                            console.warn("Failed to save chat to database:", dbErr);
                        }
                    }
                    return;
                }
                catch (groqErr) {
                    console.warn("Groq API failed, falling back to local response:", groqErr);
                    if (String(groqErr).includes("not configured")) {
                        toast.error("Groq API key not configured");
                    }
                    else {
                        toast.warning("Groq API unavailable, using local analysis");
                    }
                }
            }
            // Fallback: use local metric-based response
            const fallback = buildLocalAssistantReply(text);
            setMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
        }
        catch (e) {
            console.error("Chat error:", e);
            toast.error(e.message || "Chat failed");
            setMessages((prev) => prev.slice(0, -1)); // Remove pending assistant message
        }
        finally {
            setBusy(false);
        }
    };
    const runDiagnostics = async () => {
        if (diagBusy)
            return;
        setDiagBusy(true);
        try {
            const result = await runAiConnectivityTest();
            setDiag(result);
            if (result.ok) {
                toast.success("AI connectivity test passed.");
            }
            else {
                toast.warning("AI connectivity test found issues. See details below.");
            }
        }
        catch (e) {
            toast.error(`Diagnostics failed: ${String(e?.message || e)}`);
        }
        finally {
            setDiagBusy(false);
        }
    };
    return (<div className="mx-auto flex h-[calc(100vh-12rem)] max-w-3xl flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Sparkles className="h-7 w-7 text-primary"/> AI Health Assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          {report ? `Discussing: ${report.file_name}` : "Upload a report first to get personalized insights."}
        </p>
        <div className="mt-3">
          <Button type="button" variant="outline" onClick={runDiagnostics} disabled={diagBusy}>
            {diagBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            Run AI Connectivity Test
          </Button>
        </div>
      </div>

      {diag && (<Card className="p-4 shadow-card">
          <div className="mb-2 text-sm font-semibold">
            AI Diagnostics: {diag.ok ? "Passed" : "Issues found"}
          </div>
          <div className="space-y-2 text-sm">
            {diag.checks.map((c) => (<div key={c.name} className="rounded-md border p-2">
                <div className={cn("font-medium", c.ok ? "text-success" : "text-destructive")}>
                  {c.ok ? "PASS" : "FAIL"} · {c.name}
                </div>
                <div className="text-muted-foreground">{c.details}</div>
              </div>))}
          </div>
        </Card>)}

      <Card className="flex flex-1 flex-col overflow-hidden shadow-card">
        <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (<div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary shadow-elevated">
                <Bot className="h-7 w-7 text-primary-foreground"/>
              </div>
              <p className="text-sm text-muted-foreground">Ask me anything about your health report.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (<button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-primary hover:bg-accent">
                    {s}
                  </button>))}
              </div>
            </div>)}

          {messages.map((m, i) => (<div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary">
                  <Bot className="h-4 w-4 text-primary-foreground"/>
                </div>)}
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", m.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground")}>
                {m.role === "assistant" ? (<div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-ul:my-1.5">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>) : (m.content)}
              </div>
              {m.role === "user" && (<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="h-4 w-4"/>
                </div>)}
            </div>))}

          {busy && messages[messages.length - 1]?.role === "user" && (<div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin"/> Thinking...
            </div>)}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-border bg-background/50 p-3">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your report..." disabled={busy}/>
          <Button type="submit" disabled={busy || !input.trim()} className="bg-gradient-primary">
            <Send className="h-4 w-4"/>
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        ⚕️ AI insights only — not medical advice. Consult a doctor for medical decisions.
      </p>
    </div>);
};
export default Assistant;
