import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Bot, User, Sparkles, Activity, ShieldCheck, Layers, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";
import { getLocalReportById, getLocalReports } from "@/lib/localReports";
import { runAiConnectivityTest } from "@/lib/aiConnectivity";
import { streamGroqChat, validateMessage } from "@/lib/groqService";
import { retrieveRagContext } from "@/lib/ragEngine";
import { MedicalReasoningCard } from "@/components/MedicalReasoningCard";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
    "Compare my hemoglobin and WBC across all my reports",
    "What are the key findings in my latest test?",
    "Summarize all abnormal parameters found in my report history",
    "Have my cholesterol or liver values changed over time?",
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
    const [ragMode, setRagMode] = useState(true);
    const scrollerRef = useRef(null);

    useEffect(() => {
        (async () => {
            let r = null;
            if (id?.startsWith("local_")) {
                r = getLocalReportById(id, user?.id);
            } else {
                try {
                    if (id) {
                        r = await apiClient.getReport(id);
                    } else {
                        const reports = await apiClient.getReports();
                        r = reports?.[0] || null;
                    }
                } catch (e) {
                    console.warn("Backend report load failed, using local reports:", e.message);
                    r = getLocalReports(user?.id)[0] ?? null;
                }
            }
            setReport(r);
        })();
    }, [id, user?.id]);

    useEffect(() => {
        if (!report?.id || String(report.id).startsWith("local_")) return;
        (async () => {
            try {
                const history = await apiClient.getChatMessages(report.id);
                if (Array.isArray(history) && history.length > 0) {
                    setMessages(history);
                }
            } catch (err) {
                console.warn("Could not fetch chat history:", err.message);
            }
        })();
    }, [report?.id]);

    useEffect(() => {
        scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, busy]);

    const buildLocalAssistantReply = (question) => {
        const q = (question || "").toLowerCase();
        let values = report?.values || {};
        if (typeof values === 'string') {
            try { values = JSON.parse(values); } catch(e) {}
        }
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
                    ? "High hemoglobin can occur with dehydration, smoking, or lung/bone marrow conditions."
                    : "Hemoglobin is within the normal range.";
            return `${fmt("Hemoglobin", "hemoglobin")}\n\n${meaning}\n\nNot medical advice. Please confirm with your doctor.`;
        }

        if (q.includes("worried") || q.includes("risk") || q.includes("finding") || q.includes("summarize") || q.includes("compare")) {
            const abnormal = Object.entries(values)
                .filter(([_, v]) => v?.status === "high" || v?.status === "low")
                .map(([k, v]) => `${k.toUpperCase()}: ${v.value} (${v.status})`);
            if (abnormal.length === 0) {
                return "Based on your reports, detected markers are mostly within normal ranges. Great news! Still, please confirm with your doctor.";
            }
            return `Markers outside normal range across your reports:\n- ${abnormal.join("\n- ")}\n\nPlease review these with your doctor.`;
        }

        return [
            "Based on your report context:",
            fmt("Hemoglobin", "hemoglobin"),
            fmt("WBC", "wbc"),
            fmt("RBC", "rbc"),
            fmt("Platelets", "platelets"),
            "",
            "Ask about a specific marker or enable RAG Mode to query across all historical reports.",
            "Not medical advice. Please confirm with your doctor.",
        ].join("\n");
    };

    const send = async (text) => {
        if (!text.trim() || busy) return;
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
            let values = report?.values || {};
            if (typeof values === 'string') {
                try { values = JSON.parse(values); } catch(e) {}
            }
            const summary = report?.summary || "No summary available";

            // Retrieve RAG Context across user's historical reports & curated medical knowledge base
            const { ragPromptText, citations, medicalGuidelines } = await retrieveRagContext({
                query: text,
                userId: user?.id,
                reportId: ragMode ? null : report?.id,
                activeValues: values,
                topK: 5,
            });

            let assistantReply = "";

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
                        ragPromptText,
                        temperature: 0.7,
                        maxTokens: 1024,
                        onChunk: (chunk) => {
                            assistantContent += chunk;
                            setMessages((prev) => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent, citations, medicalGuidelines } : m));
                        },
                    });
                    assistantReply = assistantContent;
                    setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: assistantContent, citations, medicalGuidelines }]);
                } catch (groqErr) {
                    console.warn("Groq API failed, using local response:", groqErr);
                    assistantReply = buildLocalAssistantReply(text);
                    setMessages((prev) => [...prev, { role: "assistant", content: assistantReply, citations, medicalGuidelines }]);
                }
            } else {
                assistantReply = buildLocalAssistantReply(text);
                setMessages((prev) => [...prev, { role: "assistant", content: assistantReply, citations, medicalGuidelines }]);
            }

            // Save to database via apiClient
            if (report?.id && !String(report.id).startsWith("local_")) {
                try {
                    await apiClient.sendChatMessage({ report_id: report.id, role: "user", content: text });
                    await apiClient.sendChatMessage({ report_id: report.id, role: "assistant", content: assistantReply });
                } catch (dbErr) {
                    console.warn("Failed to save chat message to database:", dbErr.message);
                }
            }
        } catch (e) {
            console.error("Chat error:", e);
            toast.error(e.message || "Chat failed");
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
        } catch (e) {
            toast.error(`Diagnostics failed: ${String(e?.message || e)}`);
        } finally {
            setDiagBusy(false);
        }
    };

    return (
      <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-4xl flex-col gap-4 py-2">
        {/* Header Title & RAG Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-foreground">
              <Sparkles className="h-7 w-7 text-indigo-600 dark:text-indigo-400 freud-glow-indigo" /> Freud AI RAG Assistant
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {report ? (
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" /> Active Context: <strong className="text-foreground">{report.file_name}</strong>
                </span>
              ) : (
                "Upload reports to unlock multi-document RAG search."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* RAG Mode Switcher Toggle */}
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setRagMode(false)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                  !ragMode
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Search only the currently selected lab report"
              >
                <FileText className="h-3.5 w-3.5" /> Single Report
              </button>
              <button
                type="button"
                onClick={() => setRagMode(true)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                  ragMode
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm freud-glow-indigo"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="RAG Mode: Search and synthesize across all historical uploaded reports"
              >
                <Layers className="h-3.5 w-3.5" /> All Reports (RAG Mode)
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={diagBusy}
              className="border-border bg-card text-foreground hover:bg-muted rounded-xl text-xs"
            >
              {diagBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />}
              Diagnostics
            </Button>
          </div>
        </div>

        {/* Diagnostic Results Card */}
        {diag && (
          <Card className="p-4 freud-card rounded-2xl border-border">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AI Connectivity Diagnostics: <span className={diag.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{diag.ok ? "PASSED" : "ISSUES DETECTED"}</span>
            </div>
            <div className="space-y-2 text-xs">
              {diag.checks.map((c) => (
                <div key={c.name} className="rounded-xl border border-border bg-muted/30 p-2.5">
                  <div className={cn("font-bold", c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {c.ok ? "✓ PASS" : "✗ FAIL"} · {c.name}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{c.details}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Clinical Medical Reasoning Card */}
        {report && (
          <MedicalReasoningCard values={report.values} summary={report.summary} />
        )}

        {/* Freud UI Glass Chat Card */}
        <Card className="flex flex-1 flex-col overflow-hidden freud-card rounded-3xl border-border shadow-2xl">
          <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl freud-glow-indigo">
                  <Bot className="h-8 w-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="font-bold text-lg text-foreground">Freud Multi-Report RAG Intelligence</h3>
                  <p className="text-xs text-muted-foreground">
                    {ragMode
                      ? "RAG Mode Active: Search, compare, and analyze trends across all your uploaded lab reports."
                      : "Single Report Focus: Asking questions grounded in your active report file."}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg pt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-sm"
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
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md freud-glow-indigo">
                    <Bot className="h-5 w-5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[82%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-md",
                    m.role === "user"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-br-none"
                      : "bg-card border border-border text-foreground rounded-bl-none shadow-sm"
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="space-y-3">
                      <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-code:text-indigo-600 dark:prose-code:text-indigo-300">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>

                      {/* Clickable RAG Source Citations */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Search className="h-3 w-3 text-indigo-500" /> Source Report Citations:
                          </span>
                          {m.citations.map((c, cIdx) => (
                            <Link
                              key={cIdx}
                              to={`/dashboard/${c.report_id}`}
                              className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-all shadow-xs"
                              title={`View report ${c.file_name}`}
                            >
                              <FileText className="h-3 w-3 text-indigo-500" /> {c.file_name} ({c.created_at})
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
                {m.role === "user" && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground border border-border">
                    <User className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}

            {busy && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl w-max">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" /> Freud RAG Engine is retrieving & synthesizing findings...
              </div>
            )}
          </div>

          {/* Freud Chat Input Area */}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-3 border-t border-border bg-card/80 p-4 backdrop-blur-md">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ragMode ? "Ask or compare anything across all your lab reports..." : "Ask a question about your active lab report..."}
              disabled={busy}
              className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 rounded-2xl"
            />
            <Button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl px-5 shadow-md freud-glow-indigo"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    );
};

export default Assistant;
