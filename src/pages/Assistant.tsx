import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Is my hemoglobin low?",
  "What does high WBC mean?",
  "Are my platelets normal?",
  "Should I be worried?",
];

const Assistant = () => {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      let r: any = null;
      if (id) {
        const { data } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
        r = data;
      } else {
        const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
        r = data;
      }
      setReport(r);
    })();
  }, [id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const reportContext = useMemo(() => {
    if (!report) return "";
    return `File: ${report.file_name}\nSummary: ${report.summary || "n/a"}\nValues: ${JSON.stringify(report.values || {})}\nML Prediction: ${JSON.stringify(report.prediction || {})}`;
  }, [report]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next, reportContext }),
      });
      if (resp.status === 429) { toast.error("Rate limit reached, try again shortly."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted."); setBusy(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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

      if (report?.id) {
        await supabase.from("chat_messages").insert([
          { report_id: report.id, role: "user", content: text },
          { report_id: report.id, role: "assistant", content: acc },
        ]);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Chat failed");
    } finally {
      setBusy(false);
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
      </div>

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
