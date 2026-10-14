import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Activity,
  ShieldCheck,
  Layers,
  FileText,
  Search,
  Trash2,
  MessageSquare,
  Plus,
  RotateCcw,
  ChevronRight,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/features/auth/AuthProvider";
import { apiClient } from "@/lib/apiClient";
import { PrivacyBadge } from "@/components/PrivacyBadge";
import { getLocalReportById, getLocalReports } from "@/lib/localReports";
import { runAiConnectivityTest } from "@/lib/aiConnectivity";
import { streamGroqChat, validateMessage, cleanModelResponse } from "@/lib/groqService";
import { retrieveRagContext } from "@/lib/ragEngine";
import { MedicalReasoningCard } from "@/components/MedicalReasoningCard";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What are the main findings in my lab report?",
  "What does my low hemoglobin mean in simple terms?",
  "Are any of my blood test parameters abnormal?",
  "What questions should I ask my doctor about these results?",
];

/**
 * ============================================================================
 * Assistant.jsx - Medical AI Health Assistant Component
 * ============================================================================
 * Purpose:
 *  - Manages real-time medical AI chat sessions with Groq LLM streaming.
 *  - Incorporates Dual-Source RAG (Retrieval-Augmented Generation) from user reports.
 *  - Renders 4-step pathophysiological medical reasoning card for active report.
 *  - Provides admin-only AI connectivity diagnostics.
 * ============================================================================
 */
const Assistant = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  // State Management
  const [reports, setReports] = useState([]);
  const [report, setReport] = useState(null);
  const [chatThreads, setChatThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [diag, setDiag] = useState(null);
  const [ragMode, setRagMode] = useState(false);
  const scrollerRef = useRef(null);

  // Load User Reports & Chat Threads
  const loadThreadsAndReports = async () => {
    try {
      const allReports = await apiClient.getReports();
      setReports(allReports || []);

      try {
        const threads = await apiClient.getChatThreads();
        setChatThreads(Array.isArray(threads) ? threads : []);
      } catch (tErr) {
        setChatThreads([]);
      }
    } catch (e) {
      console.warn("Backend report load fallback:", e.message);
      setReports(getLocalReports(user?.id) || []);
    }
  };

  useEffect(() => {
    loadThreadsAndReports();
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      let r = null;
      if (id?.startsWith("local_")) {
        r = getLocalReportById(id, user?.id);
      } else if (id) {
        try {
          r = await apiClient.getReport(id);
        } catch (e) {
          console.warn("Report load failed:", e.message);
          r = null;
        }
      } else {
        r = null; // General Chat mode when no report id in URL
      }
      setReport(r);
    })();
  }, [id, user?.id]);

  // Fetch Chat Messages for active report / session
  const fetchActiveChatHistory = async () => {
    try {
      const activeReportId = report?.id && !String(report.id).startsWith("local_") ? report.id : null;
      const history = await apiClient.getChatMessages(activeReportId);
      setMessages(Array.isArray(history) ? history : []);
    } catch (err) {
      console.warn("Could not fetch active chat messages:", err.message);
      setMessages([]);
    }
  };

  useEffect(() => {
    fetchActiveChatHistory();
  }, [report?.id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const handleDeleteThread = async (targetReportId) => {
    try {
      const targetId = targetReportId || null;
      await apiClient.deleteChatMessages(targetId);
      toast.success("Chat history deleted.");

      const currentReportId = report?.id || null;
      if (currentReportId === targetId) {
        setMessages([]);
      }
      await loadThreadsAndReports();
    } catch (err) {
      console.error("Delete Thread Error:", err);
      toast.error("Failed to delete chat thread");
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await apiClient.clearAllChatMessages();
      setMessages([]);
      setChatThreads([]);
      toast.success("All chat history cleared successfully.");
    } catch (err) {
      toast.error("Failed to clear chat history");
    }
  };

  const buildLocalAssistantReply = (question, guidelines = []) => {
    const q = (question || "").toLowerCase().trim();

    // Check non-medical triggers
    const nonMedicalTriggers = [
      "python", "javascript", "react", "html", "css", "code", "coding", "programming", "script",
      "world cup", "football", "cricket", "nba", "movie", "song", "cinema", "actor", "actress",
      "stock market", "crypto", "bitcoin", "investing", "capital of", "who is the president", "history of"
    ];
    if (nonMedicalTriggers.some((t) => q.includes(t))) {
      return "I am an AI Health Assistant specialized exclusively in medical, health, and laboratory topics. Please ask me a question related to your health, lab reports, medications, or medical conditions.";
    }

    let values = report?.values || {};
    if (typeof values === "string") {
      try { values = JSON.parse(values); } catch (e) {}
    }
    const detected = Object.entries(values).filter(([, v]) => v?.value != null);
    const abnormal = detected.filter(([, v]) => v?.status === "low" || v?.status === "high");
    const summary = report?.summary || "No active report summary available.";

    // 1. Doctor questions inquiry
    if (q.includes("ask my doctor") || q.includes("questions for doctor") || q.includes("doctor questions") || q.includes("physician")) {
      const questionsList = abnormal.length > 0
        ? abnormal.map(([k, v]) => `1. What underlying factors are contributing to my ${v.status.toUpperCase()} ${k.toUpperCase()} (${v.value} ${v.unit || ""})?`).slice(0, 3)
        : ["1. Are all my lab results within optimal ranges for my health baseline?", "2. When do you recommend scheduling my next screening panel?"];

      return `📌 **Direct Answer:**
Here are the most important targeted questions to discuss with your physician based on your laboratory report:

${questionsList.join("\n")}
${abnormal.length > 0 ? "3. Do you recommend any dietary changes or follow-up testing?" : ""}

💡 **What This Means:**
Taking structured questions to your appointment ensures your doctor can correlate these specific lab metrics with your personal medical history and symptoms.

🩺 **Questions for Your Doctor:**
- "Are any repeat blood tests recommended to monitor these values?"
- "Do you recommend any lifestyle or medication adjustments?"

*Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis.*`;
    }

    // 2. Specific biomarker inquiry (e.g., hemoglobin, glucose, hba1c, etc.)
    const markerAliasMap = {
      hemoglobin: ["hemoglobin", "hgb", "hb", "anemia"],
      hba1c: ["hba1c", "a1c", "glycated hemoglobin"],
      glucose: ["glucose", "sugar", "blood sugar", "diabetes"],
      wbc: ["wbc", "white blood", "leukocyte", "infection"],
      rbc: ["rbc", "red blood"],
      platelets: ["platelet", "platelets", "plt", "clotting"],
      creatinine: ["creatinine", "kidney", "renal", "gfr"],
      alt: ["alt", "sgpt", "liver"],
      ast: ["ast", "sgot"],
      crp: ["crp", "c-reactive", "inflammation"],
    };

    let targetKey = null;
    for (const [key, aliases] of Object.entries(markerAliasMap)) {
      if (aliases.some((a) => q.includes(a))) {
        targetKey = key;
        break;
      }
    }

    if (targetKey) {
      const foundEntry = detected.find(([k]) => k.toLowerCase() === targetKey);
      const matchedGuideline = guidelines?.find((g) => g.marker?.toLowerCase().includes(targetKey)) || null;

      if (foundEntry) {
        const [mKey, mVal] = foundEntry;
        const valStr = `${mVal.value} ${mVal.unit || ""}`.trim();
        const status = (mVal.status || "normal").toUpperCase();

        // Check if user has an inverted premise (e.g. asks why it is low when it is high)
        let correction = "";
        if (q.includes("low") && status === "HIGH") {
          correction = `Note: Your report actually classifies ${mKey.toUpperCase()} as **HIGH** (${valStr}), not low. `;
        } else if (q.includes("high") && status === "LOW") {
          correction = `Note: Your report actually classifies ${mKey.toUpperCase()} as **LOW** (${valStr}), not high. `;
        }

        const interpretation = matchedGuideline?.interpretation || (status === "HIGH" ? `Elevated ${mKey.toUpperCase()} indicates values above standard laboratory thresholds.` : status === "LOW" ? `Reduced ${mKey.toUpperCase()} indicates values below standard laboratory thresholds.` : `Your ${mKey.toUpperCase()} is within standard reference ranges.`);
        const causes = matchedGuideline?.possibleCauses?.length ? matchedGuideline.possibleCauses.slice(0, 3).map((c) => `- ${c}`).join("\n") : "- Physiological variance or lifestyle factors\n- Clinical hydration state or metabolic changes";

        return `📌 **Direct Answer:**
${correction}Your **${mKey.toUpperCase()}** is recorded at **${valStr}**, which is classified as **${status}**.

💡 **What This Means:**
${interpretation}

**Potential Considerations:**
${causes}

🩺 **Questions for Your Doctor:**
1. What could be the primary cause of this ${status} ${mKey.toUpperCase()} reading?
2. Do you recommend a repeat test or any follow-up investigation?

*Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis.*`;
      }
    }

    // 3. Abnormal values inquiry
    if (q.includes("abnormal") || q.includes("out of range") || q.includes("findings") || q.includes("high") || q.includes("low")) {
      if (abnormal.length === 0) {
        return `📌 **Direct Answer:**
All detected biomarkers in this report fall within standard laboratory reference intervals. No abnormal parameters were identified.

💡 **What This Means:**
Your results indicate homeostatic baseline stability across the tested markers.

🩺 **Questions for Your Doctor:**
1. Are my results optimal for my age and health goals?
2. When should I schedule my next routine screening?

*Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis.*`;
      }

      const abnormalList = abnormal.map(([k, v]) => `- **${k.toUpperCase()}**: ${v.value} ${v.unit || ""} (${v.status.toUpperCase()})`).join("\n");
      return `📌 **Direct Answer:**
Your report contains **${abnormal.length}** biomarker(s) outside standard reference intervals:

${abnormalList}

💡 **What This Means:**
${summary}

🩺 **Questions for Your Doctor:**
1. What underlying factors are contributing to these out-of-range values?
2. Do you recommend any lifestyle changes or follow-up blood panels?

*Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis.*`;
    }

    // 4. Default comprehensive report breakdown
    if (abnormal.length > 0) {
      const abnormalStr = abnormal.map(([k, v]) => `- **${k.toUpperCase()}**: ${v.value} ${v.unit || ""} (${v.status.toUpperCase()})`).join("\n");
      return `📌 **Direct Answer:**
Here is an overview addressing your question regarding **${report?.file_name || "your health report"}**:

${abnormalStr}

💡 **What Your Results Mean:**
${summary}

🩺 **Questions for Your Doctor:**
1. How do these findings correlate with my overall health and symptoms?
2. What next steps or follow-up tests are advised?

*Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis.*`;
    }

    return `📌 **Direct Answer:**
Based on your report **${report?.file_name || "records"}**, all detected laboratory metrics are within standard normal reference intervals.

💡 **Summary of Findings:**
${summary}

🩺 **Questions for Your Doctor:**
1. Are these results optimal for my routine wellness screening?
2. When should I complete my next routine lab evaluation?

*Disclaimer: This is for educational reference only. Please consult your physician for clinical diagnosis.*`;
  };

  const runDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const res = await runAiConnectivityTest(user?.id);
      setDiag(res);
      if (res.ok) {
        toast.success("AI Service Connectivity Passed!");
      } else {
        toast.error("AI Service Connectivity Issues Detected");
      }
    } catch (e) {
      toast.error(e.message || "Diagnostics failed");
    } finally {
      setDiagBusy(false);
    }
  };

  const send = async (text) => {
    if (!text || !text.trim() || busy) return;
    const validation = validateMessage(text);
    if (!validation.ok) {
      toast.error(validation.reason);
      return;
    }

    setInput("");
    const userMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);

    try {
      let values = report?.values || {};
      if (typeof values === "string") {
        try { values = JSON.parse(values); } catch (e) {}
      }
      const summary = report?.summary || "No summary available";

      const { ragPromptText, citations: rawCitations, medicalGuidelines } = await retrieveRagContext({
        query: text,
        userId: user?.id,
        reportId: report?.id || null,
        searchAllReports: ragMode,
        activeValues: values,
        topK: 5,
      });

      // Deduplicate citations by report_id
      const citationsMap = new Map();
      (rawCitations || []).forEach((c) => {
        const id = c.report_id || c.file_name;
        if (id && !citationsMap.has(id)) {
          citationsMap.set(id, c);
        }
      });

      // Ensure active report is cited if user is currently on an active report
      if (report?.id && !citationsMap.has(report.id)) {
        citationsMap.set(report.id, {
          report_id: report.id,
          file_name: report.file_name,
          created_at: report.created_at ? new Date(report.created_at).toLocaleDateString() : "Recent",
          metrics_text: "",
        });
      }

      const citations = Array.from(citationsMap.values());

      let assistantReply = "";

      if (import.meta.env.VITE_GROQ_API_KEY) {
        try {
          let assistantContent = "";
          const chatMessages = next.map((m) => ({
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
              const cleanedText = cleanModelResponse(assistantContent);
              setMessages((prev) =>
                prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: cleanedText, citations, medicalGuidelines } : m))
              );
            },
          });
          assistantReply = cleanModelResponse(assistantContent);
          setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: assistantReply, citations, medicalGuidelines }]);
        } catch (groqErr) {
          console.warn("Groq API failed, using local response:", groqErr);
          assistantReply = buildLocalAssistantReply(text, medicalGuidelines);
          setMessages((prev) => [...prev, { role: "assistant", content: assistantReply, citations, medicalGuidelines }]);
        }
      } else {
        assistantReply = buildLocalAssistantReply(text, medicalGuidelines);
        setMessages((prev) => [...prev, { role: "assistant", content: assistantReply, citations, medicalGuidelines }]);
      }

      try {
        const activeReportId = report?.id && !String(report.id).startsWith("local_") ? report.id : null;
        await apiClient.sendChatMessage({ report_id: activeReportId, role: "user", content: text });
        await apiClient.sendChatMessage({ report_id: activeReportId, role: "assistant", content: assistantReply });
        loadThreadsAndReports();
      } catch (dbErr) {
        console.warn("Failed to save chat message to database:", dbErr.message);
      }
    } catch (e) {
      console.error("Chat error:", e);
      toast.error(e.message || "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Glassmorphic Header */}
      <div className="glass-card rounded-3xl p-6 bg-gradient-to-r from-card via-card to-indigo-500/10 border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <Bot className="h-3.5 w-3.5" /> Clinical AI Assistant
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            AI Health Assistant & Recent Chat Sessions
          </h1>
          <p className="text-xs text-muted-foreground font-medium">
            Ask simple questions about your lab reports, review past chat threads, or delete chat sessions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <PrivacyBadge variant="compact" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRagMode(!ragMode)}
            className={cn(
              "rounded-xl text-xs font-bold border transition-all h-9 px-3.5",
              ragMode
                ? "bg-indigo-600 text-white border-indigo-500 shadow-md glow-indigo"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            )}
            title="Toggle RAG Multi-Report History Search"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            {ragMode ? "RAG Search: ALL REPORTS" : "RAG Search: ACTIVE REPORT ONLY"}
          </Button>

          {user?.role === "admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostics}
              disabled={diagBusy}
              className="border-border bg-card text-foreground hover:bg-muted text-xs font-bold rounded-xl h-9"
            >
              {diagBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />}
              AI Diagnostics
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Recent Sessions Sidebar + Right Active Chat Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT SIDEBAR: RECENT CHAT THREADS */}
        <Card className="glass-card rounded-3xl border-border p-5 space-y-4 shadow-lg lg:col-span-1">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-4 w-4 text-indigo-500" /> Recent Chat Threads
            </h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:bg-rose-500/10 rounded-lg" title="Clear All Chat History">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border text-foreground rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Clear All Chat History?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This will permanently delete all chat messages and threads from your account history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-muted text-muted-foreground rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllHistory} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl">
                    Clear All History
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* New Chat Button */}
          <Button
            onClick={() => {
              navigate("/assistant");
              setMessages([]);
              toast.info("Started new chat session.");
            }}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs h-9 shadow-md glow-indigo flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Start New Chat
          </Button>

          {/* Chat Threads List */}
          <div className="space-y-2 max-h-[540px] lg:max-h-[580px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
            {/* General AI Health Chat Session */}
            <div
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group mb-2",
                !report
                  ? "bg-indigo-500/15 border-indigo-500/40 text-foreground font-bold shadow-xs"
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => {
                navigate("/assistant");
                setReport(null);
                setMessages([]);
              }}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Bot className={cn("h-4 w-4 shrink-0", !report ? "text-indigo-500" : "text-muted-foreground")} />
                <div className="truncate">
                  <div className="text-xs truncate font-bold">General AI Health Chat</div>
                  <div className="text-[10px] text-muted-foreground font-normal">New / Independent Session</div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteThread(null);
                }}
                className="h-7 w-7 text-rose-500 hover:bg-rose-500/15 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                title="Delete General Chat Thread"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {reports.map((r) => {
              const isSelected = report?.id === r.id;
              const hasThread = chatThreads.some((t) => t.report_id === r.id);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group",
                    isSelected
                      ? "bg-indigo-500/15 border-indigo-500/40 text-foreground font-bold shadow-xs"
                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => navigate(`/assistant/${r.id}`)}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <MessageSquare className={cn("h-4 w-4 shrink-0", isSelected ? "text-indigo-500" : "text-muted-foreground")} />
                    <div className="truncate">
                      <div className="text-xs truncate font-bold">{r.file_name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {new Date(r.created_at).toLocaleDateString()} {hasThread ? "• Active Thread" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(r.id);
                      }}
                      className="h-7 w-7 text-rose-500 hover:bg-rose-500/15 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                      title="Delete Chat Thread"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* RIGHT WORKSPACE: ACTIVE CHAT WORKSPACE */}
        <div className="lg:col-span-3 space-y-4">
          {/* Diagnostic Results Card */}
          {diag && user?.role === "admin" && (
            <Card className="p-4 glass-card rounded-2xl border-border">
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
            <MedicalReasoningCard values={report.values} summary={report.summary} medicalReasoning={report.medical_reasoning} />
          )}

          {/* Glass Chat Card */}
          <Card className="flex h-[640px] min-h-[520px] flex-col overflow-hidden glass-card rounded-3xl border-border shadow-2xl">
            <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xl glow-indigo">
                    <Bot className="h-8 w-8" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="text-lg font-bold text-foreground">How can I help you today?</h3>
                    <p className="text-xs text-muted-foreground">
                      Ask simple questions about <strong className="text-foreground">{report?.file_name || "your health reports"}</strong>.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 max-w-xl text-left mt-2">
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-2xl border border-border bg-card p-3 text-xs font-semibold text-foreground hover:border-indigo-500/50 hover:bg-muted/50 transition-all text-left shadow-xs"
                      >
                        "{s}"
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-3 text-xs leading-relaxed", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md glow-indigo mt-0.5">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-3xl p-4 shadow-md",
                      m.role === "user"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-tr-xs"
                        : "bg-card border border-border text-foreground rounded-tl-xs"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <div className="space-y-3 font-sans">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                          <ReactMarkdown>
                            {m.content}
                          </ReactMarkdown>
                        </div>

                        {/* Evidence Source Report Citations Badges */}
                        {m.citations && m.citations.length > 0 && (() => {
                          const uniqueBadges = Array.from(
                            new Map(m.citations.map((c) => [c.report_id || c.file_name, c])).values()
                          );
                          if (uniqueBadges.length === 0) return null;
                          return (
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-border/60">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                                <Search className="h-3 w-3 text-indigo-500" /> Evidence Sources:
                              </span>
                              {uniqueBadges.map((c, cIdx) => (
                                <Link
                                  key={c.report_id || cIdx}
                                  to={`/dashboard/${c.report_id}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-all shadow-xs"
                                  title={`View source report ${c.file_name}`}
                                >
                                  <FileText className="h-3 w-3 text-indigo-500" /> {c.file_name} ({c.created_at})
                                </Link>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground border border-border mt-0.5">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}

              {busy && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-2.5 rounded-2xl w-max">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> LabSense AI is reviewing guidelines and generating a clear answer...
                </div>
              )}
            </div>

            {/* Chat Input Area */}
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-3 border-t border-border bg-card/80 p-4 backdrop-blur-md">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={report ? `Ask a simple question about ${report.file_name}...` : "Ask any health question..."}
                disabled={busy}
                className="flex-1 bg-muted/50 border-border text-xs rounded-2xl focus-visible:ring-indigo-500 h-11"
              />
              <Button
                type="submit"
                disabled={busy || !input.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl h-11 px-5 shadow-md glow-indigo shrink-0"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
